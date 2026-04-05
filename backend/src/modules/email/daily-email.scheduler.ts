import cron from 'node-cron';
import { prisma } from '../../lib/prisma.js';
import {
  getDailyGoalSummary,
  getPartnerGoalSummary,
} from '../plannedGoals/plannedGoals.service.js';
import { sendDailyAccountabilityEmail } from './email.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function localHHMM(date: Date, timezone: string): string {
  try {
    // Returns "HH:MM" in the given IANA timezone
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date); // "HH:MM"
  } catch {
    return '00:00';
  }
}

function localDateKey(date: Date, timezone: string): string {
  try {
    // en-CA locale gives "YYYY-MM-DD"
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Return true if currentHHMM falls in the [targetHHMM, targetHHMM+5min) window */
function isWithinWindow(currentHHMM: string, targetHHMM: string): boolean {
  const [ch, cm] = currentHHMM.split(':').map(Number);
  const [th, tm] = targetHHMM.split(':').map(Number);
  const currentMinutes = ch * 60 + cm;
  const targetMinutes = th * 60 + tm;
  return currentMinutes >= targetMinutes && currentMinutes < targetMinutes + 5;
}

// ---------------------------------------------------------------------------
// Core sweep
// ---------------------------------------------------------------------------

async function runDailyEmailSweep(now: Date): Promise<void> {
  const preferences = await prisma.userPreference.findMany({
    where: { dailyEmailEnabled: true },
    include: {
      user: {
        select: { id: true, name: true, email: true, timezone: true },
      },
    },
  });

  for (const pref of preferences) {
    const user = pref.user;
    const tz = user.timezone ?? 'UTC';
    const currentHHMM = localHHMM(now, tz);
    const targetHHMM = pref.dailyEmailTime;

    if (!isWithinWindow(currentHHMM, targetHHMM)) continue;

    const dateKey = localDateKey(now, tz);

    // Skip if already sent today
    const alreadySent = await prisma.dailyEmailLog.findUnique({
      where: { userId_dateKey: { userId: user.id, dateKey } },
    });
    if (alreadySent) continue;

    // Best-effort email send - errors are caught individually
    try {
      const [mySummary, partnerSummaries] = await Promise.all([
        getDailyGoalSummary(user.id, now, pref.workspaceId),
        getPartnerGoalSummary(user.id, now, pref.workspaceId),
      ]);

      // Resolve partner name for the first partner (PARTNER workspace has exactly one)
      let partnerName: string | null = null;
      let partnerSummary = partnerSummaries[0] ?? null;

      if (partnerSummary) {
        const partnerUser = await prisma.user.findUnique({
          where: { id: partnerSummary.userId },
          select: { name: true },
        });
        partnerName = partnerUser?.name ?? null;
      }

      await sendDailyAccountabilityEmail({
        to: user.email,
        userName: user.name,
        mySummary: {
          totalGoals: mySummary.totalGoals,
          completedGoals: mySummary.completedGoals,
          completionPercentage: mySummary.completionPercentage,
          remainingGoalTitles: mySummary.remainingGoalTitles,
          streak: mySummary.streak,
        },
        partnerName,
        partnerSummary: partnerSummary
          ? {
              totalGoals: partnerSummary.totalGoals,
              completedGoals: partnerSummary.completedGoals,
              completionPercentage: partnerSummary.completionPercentage,
              remainingGoalTitles: partnerSummary.remainingGoalTitles,
              streak: partnerSummary.streak,
            }
          : null,
      });

      // Record send - upsert guards against race conditions
      await prisma.dailyEmailLog.upsert({
        where: { userId_dateKey: { userId: user.id, dateKey } },
        update: {},
        create: { userId: user.id, workspaceId: pref.workspaceId, dateKey },
      });

      console.log(`[email] Daily accountability email sent to ${user.email} (${dateKey})`);
    } catch (err) {
      // Log but continue - no DailyEmailLog written means we retry next window
      console.error(`[email] Failed to send daily email to ${user.email}:`, err);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function startDailyEmailScheduler(): void {
  cron.schedule('*/5 * * * *', async () => {
    await runDailyEmailSweep(new Date());
  });

  console.log('Daily email scheduler active every 5 minutes.');
}
