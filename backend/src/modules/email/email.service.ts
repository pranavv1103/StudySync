import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GoalSummaryForEmail = {
  totalGoals: number;
  completedGoals: number;
  completionPercentage: number;
  remainingGoalTitles: string[];
  streak: {
    currentStreakDays: number;
  } | null;
};

// ---------------------------------------------------------------------------
// Transporter (lazy-created so missing SMTP config is a soft failure)
// ---------------------------------------------------------------------------

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (_transporter) return _transporter;

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }

  _transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  return _transporter;
}

// ---------------------------------------------------------------------------
// Tone helpers
// ---------------------------------------------------------------------------

type Tone = 'warning' | 'on-track' | 'encouraging';

function getTone(completionPercentage: number): Tone {
  if (completionPercentage >= 80) return 'encouraging';
  if (completionPercentage >= 50) return 'on-track';
  return 'warning';
}

const TONE_CONFIG: Record<
  Tone,
  { headerBg: string; headerText: string; badge: string; headline: string; sub: string }
> = {
  warning: {
    headerBg: '#fef3c7',
    headerText: '#92400e',
    badge: '#f59e0b',
    headline: 'Heads up - you still have goals to tackle today',
    sub: 'There is still time to make progress. Log in and keep the streak alive.',
  },
  'on-track': {
    headerBg: '#e0f2fe',
    headerText: '#075985',
    badge: '#0ea5e9',
    headline: "You're making progress - keep pushing!",
    sub: 'Good work today. A little more effort and you will hit your goals.',
  },
  encouraging: {
    headerBg: '#d1fae5',
    headerText: '#065f46',
    badge: '#10b981',
    headline: 'Amazing work today! You are crushing it.',
    sub: "You are on fire! Keep up the incredible momentum and inspire your accountability buddy.",
  },
};

// ---------------------------------------------------------------------------
// HTML template builder
// ---------------------------------------------------------------------------

function buildProgressBlock(
  title: string,
  summary: GoalSummaryForEmail,
  accentColor: string,
): string {
  const pct = Math.round(summary.completionPercentage);
  const barWidth = Math.min(pct, 100);

  const pendingItems =
    summary.remainingGoalTitles.length > 0
      ? summary.remainingGoalTitles
          .slice(0, 5)
          .map((g) => `<li style="margin:3px 0;color:#374151;">${g}</li>`)
          .join('')
      : '<li style="color:#6b7280;font-style:italic;">All goals completed!</li>';

  const morePending =
    summary.remainingGoalTitles.length > 5
      ? `<li style="color:#6b7280;">...and ${summary.remainingGoalTitles.length - 5} more</li>`
      : '';

  const streakLine =
    summary.streak && summary.streak.currentStreakDays > 0
      ? `<p style="margin:8px 0 0;font-size:13px;color:#6b7280;">Current streak: ${summary.streak.currentStreakDays} day${summary.streak.currentStreakDays === 1 ? '' : 's'}</p>`
      : '';

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
      <tr>
        <td style="padding:14px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb;">
          <strong style="font-size:15px;color:#111827;">${title}</strong>
        </td>
      </tr>
      <tr>
        <td style="padding:16px;">
          <p style="margin:0 0 10px;font-size:14px;color:#374151;">
            <strong>${summary.completedGoals}</strong> of <strong>${summary.totalGoals}</strong> goal${summary.totalGoals === 1 ? '' : 's'} completed
            &nbsp;<span style="display:inline-block;background:${accentColor};color:#fff;border-radius:999px;padding:1px 8px;font-size:12px;font-weight:600;">${pct}%</span>
          </p>
          <!-- progress bar -->
          <div style="background:#e5e7eb;border-radius:999px;height:8px;overflow:hidden;margin-bottom:12px;">
            <div style="width:${barWidth}%;background:${accentColor};height:8px;border-radius:999px;"></div>
          </div>
          ${streakLine}
          ${
            summary.totalGoals > 0
              ? `<p style="margin:12px 0 4px;font-size:13px;font-weight:600;color:#374151;">Pending goals:</p>
                 <ul style="margin:0;padding-left:18px;font-size:13px;">
                   ${pendingItems}
                   ${morePending}
                 </ul>`
              : '<p style="margin:8px 0 0;font-size:13px;color:#6b7280;font-style:italic;">No goals planned today.</p>'
          }
        </td>
      </tr>
    </table>
  `;
}

function buildEmailHtml(params: {
  userName: string;
  mySummary: GoalSummaryForEmail;
  partnerName: string | null;
  partnerSummary: GoalSummaryForEmail | null;
  tone: Tone;
  appUrl: string;
}): string {
  const cfg = TONE_CONFIG[params.tone];
  const accentColor = cfg.badge;
  const myBlock = buildProgressBlock('Your Progress', params.mySummary, accentColor);
  const partnerBlock =
    params.partnerName && params.partnerSummary
      ? buildProgressBlock(`${params.partnerName}'s Progress`, params.partnerSummary, '#8b5cf6')
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">

          <!-- Header -->
          <tr>
            <td style="background:${cfg.headerBg};padding:28px 32px 24px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:.05em;color:${cfg.headerText};text-transform:uppercase;">StudySync - Daily Update</p>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:${cfg.headerText};line-height:1.3;">${cfg.headline}</h1>
              <p style="margin:8px 0 0;font-size:14px;color:${cfg.headerText};opacity:.85;">${cfg.sub}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px 32px;">
              <p style="margin:0 0 20px;font-size:15px;color:#374151;">Hi ${params.userName},</p>

              ${myBlock}
              ${partnerBlock}

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-top:8px;">
                    <a href="${params.appUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">Open StudySync</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                You are receiving this because you enabled daily accountability emails in StudySync settings.<br />
                To stop, turn off "Daily Accountability Email" in your Settings.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function sendDailyAccountabilityEmail(params: {
  to: string;
  userName: string;
  mySummary: GoalSummaryForEmail;
  partnerName: string | null;
  partnerSummary: GoalSummaryForEmail | null;
}): Promise<void> {
  const transporter = getTransporter();

  if (!transporter) {
    console.warn('[email] SMTP not configured - skipping daily accountability email for', params.to);
    return;
  }

  const tone = getTone(params.mySummary.completionPercentage);
  const appUrl = env.CLIENT_URL ?? 'https://studysync.app';

  const html = buildEmailHtml({
    userName: params.userName,
    mySummary: params.mySummary,
    partnerName: params.partnerName,
    partnerSummary: params.partnerSummary,
    tone,
    appUrl,
  });

  const toneLabel: Record<Tone, string> = {
    warning: 'Time to tackle your goals today',
    'on-track': 'Keep pushing - great progress!',
    encouraging: 'Amazing work today!',
  };

  await transporter.sendMail({
    from: env.SMTP_FROM ?? env.SMTP_USER,
    to: params.to,
    subject: `StudySync Daily Update - ${toneLabel[tone]}`,
    html,
  });
}
