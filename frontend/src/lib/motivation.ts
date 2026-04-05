/**
 * Motivation engine — generates greeting text, milestone messages, daily quotes,
 * and celebration messages. Pure functions, no side effects.
 */

import { todayDateKey } from './dateKey';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ProgressState =
  | 'no-goals'
  | 'no-progress'
  | 'partial'
  | 'half'
  | 'near-done'
  | 'complete';

export type MilestoneType =
  | 'first-task'
  | 'halfway'
  | 'all-done'
  | 'both-done'
  | 'streak-alive'
  | 'comeback'
  | 'partner-done';

export type GreetingContext = {
  name: string;
  totalGoals: number;
  completedGoals: number;
  completionPercent: number;
  streakDays: number;
  isToday: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Time-of-day helper
// ─────────────────────────────────────────────────────────────────────────────

export function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

// ─────────────────────────────────────────────────────────────────────────────
// Anti-repetition: pick a pseudorandom item based on date + seed so it doesn't
// change on every re-render but does rotate daily.
// ─────────────────────────────────────────────────────────────────────────────

function pickByDay<T>(items: T[], seed = 0): T {
  const today = todayDateKey(); // "2026-04-05"
  const numeric = parseInt(today.replace(/-/g, ''), 10) + seed;
  return items[numeric % items.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// Greetings
// ─────────────────────────────────────────────────────────────────────────────

const GREETINGS_MORNING_NO_GOALS = [
  (name: string) => `Morning, ${name}. Ready to plan what you'll conquer today?`,
  (name: string) => `Good morning, ${name}. Your goals are waiting to be set.`,
  (name: string) => `Rise and build, ${name}. What are you working on today?`,
];

const GREETINGS_MORNING_HAS_GOALS = [
  (name: string) => `Good morning, ${name}. Let's make today count.`,
  (name: string) => `Hey ${name}, your goals are ready — go get them.`,
  (name: string) => `Morning, ${name}. You've got work to do. Let's go.`,
  (name: string) => `${name}, today's goals are set. Time to crush them.`,
];

const GREETINGS_COMPLETE = [
  (name: string) => `Incredible, ${name}. Everything's checked off. You showed up fully today.`,
  (name: string) => `${name}, you're done. That takes real discipline.`,
  (name: string) => `All goals cleared, ${name}. That's the kind of day that compounds.`,
  (name: string) => `${name}, you crushed it today. Rest well, seriously.`,
];

const GREETINGS_PARTIAL_AFTERNOON = [
  (name: string) => `Hey ${name}, afternoon check-in. You're partway there — keep pushing.`,
  (name: string) => `${name}, the day's still yours. Finish what you started.`,
  (name: string) => `Good afternoon, ${name}. Progress made. More to go. You've got this.`,
];

const GREETINGS_PARTIAL_EVENING = [
  (name: string) => `${name}, evening's here. A few goals still need you.`,
  (name: string) => `Hey ${name}, day's winding down — let's close the loop on those pending goals.`,
  (name: string) => `${name}, one final push. Your future self will thank you.`,
];

const GREETINGS_NIGHT = [
  (name: string) => `Working late, ${name}? Respect the hustle.`,
  (name: string) => `Still going, ${name}. Consistency beats perfection every time.`,
  (name: string) => `${name}, late night grind. Don't forget to rest after this.`,
];

const GREETINGS_NO_PROGRESS = [
  (name: string) => `${name}, you're here. That already counts. Let's start with one.`,
  (name: string) => `Hey ${name}, still early. You can still make today worthwhile.`,
  (name: string) => `${name}, small progress still matters. Pick one goal and go.`,
  (name: string) => `Good to see you, ${name}. Ready to make your first move today?`,
];

export function buildGreeting(ctx: GreetingContext): string {
  const { name, totalGoals, completedGoals, completionPercent, isToday } = ctx;
  const tod = getTimeOfDay();

  if (!isToday) {
    return `Viewing past goals for ${name}.`;
  }

  if (totalGoals === 0) {
    return pickByDay(GREETINGS_MORNING_NO_GOALS, 0)(name);
  }

  if (completedGoals >= totalGoals && completionPercent >= 100) {
    return pickByDay(GREETINGS_COMPLETE, 3)(name);
  }

  if (completedGoals === 0) {
    if (tod === 'morning') {
      return pickByDay(GREETINGS_MORNING_HAS_GOALS, 1)(name);
    }
    return pickByDay(GREETINGS_NO_PROGRESS, 4)(name);
  }

  if (tod === 'morning') {
    return pickByDay(GREETINGS_MORNING_HAS_GOALS, 1)(name);
  }
  if (tod === 'afternoon') {
    return pickByDay(GREETINGS_PARTIAL_AFTERNOON, 2)(name);
  }
  if (tod === 'evening') {
    return pickByDay(GREETINGS_PARTIAL_EVENING, 5)(name);
  }
  return pickByDay(GREETINGS_NIGHT, 6)(name);
}

// ─────────────────────────────────────────────────────────────────────────────
// Milestone messages
// ─────────────────────────────────────────────────────────────────────────────

const MILESTONE_MESSAGES: Record<MilestoneType, { title: string; body: string; emoji: string }[]> = {
  'first-task': [
    { emoji: '🔥', title: 'Nice start.', body: "You've made your first move today. Keep that energy." },
    { emoji: '✅', title: 'First one down.', body: 'The hardest part is starting. You did it.' },
    { emoji: '⚡', title: 'Momentum unlocked.', body: 'One done. Build on it.' },
  ],
  halfway: [
    { emoji: '🎯', title: "Halfway there.", body: 'Great momentum. The second half is yours too.' },
    { emoji: '💪', title: '50% done.', body: "You're in the zone. Don't stop now." },
    { emoji: '🚀', title: 'Midpoint reached.', body: 'Solid progress. Keep going.' },
  ],
  'all-done': [
    { emoji: '🏆', title: 'All goals completed!', body: 'You did it. Every single one. That takes real discipline.' },
    { emoji: '🌟', title: 'Full completion!', body: 'Every goal checked off. That\'s the kind of day that compounds.' },
    { emoji: '🎉', title: 'Day complete!', body: 'Outstanding. You showed up fully for yourself today.' },
  ],
  'both-done': [
    { emoji: '💫', title: 'Both of you showed up!', body: 'You and your partner both finished today. That\'s rare consistency.' },
    { emoji: '🤝', title: 'Perfect sync.', body: 'Both partners done for the day. Love that energy.' },
    { emoji: '🔥', title: 'Unstoppable duo.', body: 'Both of you crushed it today. This is accountability in action.' },
  ],
  'streak-alive': [
    { emoji: '🛡️', title: 'Streak protected.', body: "Your consistency streak is alive. Don't break the chain." },
    { emoji: '🔁', title: 'Streak extended!', body: 'Another day, another win. Streaks compound like interest.' },
    { emoji: '⚡', title: 'On a roll!', body: "You're building real momentum. Keep protecting your streak." },
  ],
  comeback: [
    { emoji: '💪', title: 'Comeback mode.', body: "Yesterday was rough. Today is a fresh page. Let's write something good." },
    { emoji: '🌅', title: 'New day, new start.', body: 'Yesterday doesn\'t define today. You\'re here now.' },
    { emoji: '🔑', title: 'Getting back on track.', body: 'Showing up again is the hardest part. You did it.' },
  ],
  'partner-done': [
    { emoji: '👀', title: 'Your partner is ahead.', body: 'They finished up their goals. What about you?' },
    { emoji: '🏃', title: 'Partner completed.', body: 'Your accountability buddy is done. Time to catch up!' },
    { emoji: '💬', title: "Partner's cheering for you.", body: "They've done their part. Time to do yours." },
  ],
};

export function getMilestoneMessage(type: MilestoneType): {
  title: string;
  body: string;
  emoji: string;
} {
  return pickByDay(MILESTONE_MESSAGES[type], MILESTONE_MESSAGES[type].length);
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily motivational quotes
// ─────────────────────────────────────────────────────────────────────────────

const DAILY_QUOTES = [
  { text: 'Small daily improvements are the key to staggering long-term results.', author: 'Unknown' },
  { text: 'Success is the sum of small efforts repeated day in and day out.', author: 'Robert Collier' },
  { text: "You don't have to be great to start, but you have to start to be great.", author: 'Zig Ziglar' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Unknown' },
  { text: 'Consistency is what transforms average into excellence.', author: 'Unknown' },
  { text: "Don't count the days, make the days count.", author: 'Muhammad Ali' },
  { text: 'It\'s not about having time, it\'s about making time.', author: 'Unknown' },
  { text: 'Action is the foundational key to all success.', author: 'Pablo Picasso' },
  { text: 'Progress, not perfection.', author: 'Unknown' },
  { text: 'Do something today that your future self will thank you for.', author: 'Sean Patrick Flanery' },
  { text: 'Work hard in silence; let your success be your noise.', author: 'Frank Ocean' },
  { text: 'Push yourself, because no one else is going to do it for you.', author: 'Unknown' },
  { text: 'Great things never come from comfort zones.', author: 'Unknown' },
  { text: 'The harder you work, the luckier you get.', author: 'Gary Player' },
];

export function getDailyQuote(): { text: string; author: string } {
  return pickByDay(DAILY_QUOTES, 7);
}

// ─────────────────────────────────────────────────────────────────────────────
// Companion messages (shown by the widget)
// ─────────────────────────────────────────────────────────────────────────────

const COMPANION_IDLE_MESSAGES = [
  "You've got this. One task at a time.",
  'Consistency beats intensity. Every single day.',
  "Small steps today, big wins tomorrow.",
  "You're closer than you think.",
  "Don't wait for motivation. Build discipline.",
  'Your future self is watching. Do the work.',
  "Focus. You showed up today — that matters.",
  "Keep the streak alive. It's worth protecting.",
];

export function getCompanionMessage(): string {
  return pickByDay(COMPANION_IDLE_MESSAGES, 9);
}

// ─────────────────────────────────────────────────────────────────────────────
// Milestone detection helper
// ─────────────────────────────────────────────────────────────────────────────

export function detectMilestone(
  prev: { completedGoals: number; completionPercent: number; totalGoals: number } | null,
  next: { completedGoals: number; completionPercent: number; totalGoals: number },
  partnerCompleted: boolean,
): MilestoneType | null {
  if (!prev || next.totalGoals === 0) return null;

  // First task completed
  if (prev.completedGoals === 0 && next.completedGoals > 0) return 'first-task';

  // Crossed 50%
  if (prev.completionPercent < 50 && next.completionPercent >= 50 && next.completionPercent < 100) return 'halfway';

  // All done
  if (prev.completedGoals < next.totalGoals && next.completedGoals >= next.totalGoals) {
    if (partnerCompleted) return 'both-done';
    return 'all-done';
  }

  // Partner just finished
  if (partnerCompleted && prev.completedGoals < next.completedGoals) return 'partner-done';

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// LocalStorage-backed "shown today" deduplication
// ─────────────────────────────────────────────────────────────────────────────

const SHOWN_KEY = 'studysync-milestones-shown';

function getShownMilestones(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(SHOWN_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

export function hasMilestoneBeenShown(dateKey: string, type: MilestoneType): boolean {
  const shown = getShownMilestones();
  return (shown[dateKey] ?? []).includes(type);
}

export function markMilestoneShown(dateKey: string, type: MilestoneType): void {
  const shown = getShownMilestones();
  const list = shown[dateKey] ?? [];
  if (!list.includes(type)) {
    list.push(type);
  }
  shown[dateKey] = list;
  // Prune entries older than 7 days
  const today = todayDateKey();
  for (const key of Object.keys(shown)) {
    if (key < today) delete shown[key];
  }
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify(shown));
  } catch {
    // Ignore storage errors
  }
}
