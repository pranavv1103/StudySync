/**
 * Motivation engine - generates greeting text, milestone messages, daily quotes,
 * companion messages, weekly badges, streak logic, and focus card content.
 * Pure functions, no side effects.
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
  | 'quarter'
  | 'halfway'
  | 'three-quarter'
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
  streakAtRisk?: boolean;
};

export type WeeklyBadge = {
  id: string;
  label: string;
  emoji: string;
  description: string;
  minDaysRequired: number;
};

export type EndOfDaySummary = {
  completedGoals: number;
  totalGoals: number;
  completionPercent: number;
  streakDays: number;
  streakGained: boolean;
  partnerCompleted: boolean;
  partnerName: string;
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
// Anti-repetition: pick a pseudorandom item based on date + seed so it does
// not change on every re-render but rotates daily.
// ─────────────────────────────────────────────────────────────────────────────

function pickByDay<T>(items: T[], seed = 0): T {
  const today = todayDateKey();
  const numeric = parseInt(today.replace(/-/g, ''), 10) + seed;
  return items[numeric % items.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// Greetings
// ─────────────────────────────────────────────────────────────────────────────

const GREETINGS_NO_GOALS = [
  (name: string) => `Morning, ${name}. Ready to plan what you will conquer today?`,
  (name: string) => `Good morning, ${name}. Your goals are waiting to be set.`,
  (name: string) => `Rise and build, ${name}. What are you working on today?`,
  (name: string) => `Hey ${name}, no goals set yet. Take a minute to plan your day.`,
];

const GREETINGS_MORNING_HAS_GOALS = [
  (name: string) => `Good morning, ${name}. Let's make today count.`,
  (name: string) => `Hey ${name}, your goals are ready. Go get them.`,
  (name: string) => `Morning, ${name}. You've got work to do. Let's go.`,
  (name: string) => `${name}, today's goals are set. Time to crush them.`,
  (name: string) => `Good morning, ${name}. One focused day at a time.`,
];

const GREETINGS_COMPLETE = [
  (name: string) => `Incredible, ${name}. Everything is checked off. You showed up fully today.`,
  (name: string) => `${name}, you are done. That takes real discipline.`,
  (name: string) => `All goals cleared, ${name}. That's the kind of day that compounds.`,
  (name: string) => `${name}, you crushed it today. Rest well, seriously.`,
  (name: string) => `Full completion, ${name}. Your future self thanks you.`,
];

const GREETINGS_PARTIAL_AFTERNOON = [
  (name: string) => `Hey ${name}, afternoon check-in. You're partway there. Keep pushing.`,
  (name: string) => `${name}, the day's still yours. Finish what you started.`,
  (name: string) => `Good afternoon, ${name}. Progress made. More to go. You've got this.`,
  (name: string) => `${name}, you're in the middle of a good day. Don't lose the momentum.`,
];

const GREETINGS_PARTIAL_EVENING = [
  (name: string) => `${name}, evening is here. A few goals still need you.`,
  (name: string) => `Hey ${name}, day's winding down. Let's close the loop on those pending goals.`,
  (name: string) => `${name}, one final push. Your future self will thank you.`,
  (name: string) => `Evening, ${name}. You started today. Finish strong.`,
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

const GREETINGS_STREAK_AT_RISK = [
  (name: string) => `${name}, your streak is on the line today. A small win keeps it alive.`,
  (name: string) => `Hey ${name}, one task today protects your streak. Don't let it break.`,
  (name: string) => `${name}, the chain is close to breaking. One goal is all it takes.`,
];

const GREETINGS_COMEBACK = [
  (name: string) => `Fresh start today, ${name}. Let's rebuild momentum.`,
  (name: string) => `${name}, yesterday doesn't define today. You're here now.`,
  (name: string) => `Hey ${name}, showing up again is the hardest part. You did it.`,
];

export function buildGreeting(ctx: GreetingContext): string {
  const { name, totalGoals, completedGoals, completionPercent, isToday, streakAtRisk } = ctx;
  const tod = getTimeOfDay();

  if (!isToday) {
    return `Viewing past goals for ${name}.`;
  }

  if (totalGoals === 0) {
    return pickByDay(GREETINGS_NO_GOALS, 0)(name);
  }

  if (completedGoals >= totalGoals && completionPercent >= 100) {
    return pickByDay(GREETINGS_COMPLETE, 3)(name);
  }

  if (streakAtRisk) {
    return pickByDay(GREETINGS_STREAK_AT_RISK, 11)(name);
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

export function buildComebackGreeting(name: string): string {
  return pickByDay(GREETINGS_COMEBACK, 12)(name);
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
  quarter: [
    { emoji: '📈', title: '25% there.', body: 'Solid start. Keep the pace going.' },
    { emoji: '🌱', title: 'Quarter done.', body: "You're building momentum. Don't stop here." },
    { emoji: '👣', title: 'Good progress.', body: 'One quarter through. Three more quarters to go.' },
  ],
  halfway: [
    { emoji: '🎯', title: 'Halfway there.', body: 'Great momentum. The second half is yours too.' },
    { emoji: '💪', title: '50% done.', body: "You're in the zone. Don't stop now." },
    { emoji: '🚀', title: 'Midpoint reached.', body: 'Solid progress. Keep going.' },
  ],
  'three-quarter': [
    { emoji: '🏁', title: 'Almost there.', body: "75% done. You're in the final stretch. Finish strong." },
    { emoji: '⚡', title: 'Three quarters down.', body: 'So close. One more push and you are done.' },
    { emoji: '🌟', title: 'Strong finish ahead.', body: "You've come this far. Close it out." },
  ],
  'all-done': [
    { emoji: '🏆', title: 'All goals completed!', body: 'You did it. Every single one. That takes real discipline.' },
    { emoji: '🌟', title: 'Full completion!', body: "Every goal checked off. That's the kind of day that compounds." },
    { emoji: '🎉', title: 'Day complete!', body: 'Outstanding. You showed up fully for yourself today.' },
    { emoji: '🔥', title: 'Perfect day.', body: "Every goal done. You crushed it." },
  ],
  'both-done': [
    { emoji: '💫', title: 'Both of you showed up!', body: "You and your partner both finished today. That's rare consistency." },
    { emoji: '🤝', title: 'Perfect sync.', body: 'Both partners done for the day. Love that energy.' },
    { emoji: '🔥', title: 'Unstoppable duo.', body: "Both of you crushed it today. This is accountability in action." },
  ],
  'streak-alive': [
    { emoji: '🛡️', title: 'Streak protected.', body: "Your consistency streak is alive. Don't break the chain." },
    { emoji: '🔁', title: 'Streak extended!', body: 'Another day, another win. Streaks compound like interest.' },
    { emoji: '⚡', title: 'On a roll!', body: "You're building real momentum. Keep protecting your streak." },
  ],
  comeback: [
    { emoji: '💪', title: 'Comeback mode.', body: "Yesterday was rough. Today is a fresh page. Let's write something good." },
    { emoji: '🌅', title: 'New day, new start.', body: "Yesterday doesn't define today. You're here now." },
    { emoji: '🔑', title: 'Getting back on track.', body: 'Showing up again is the hardest part. You did it.' },
  ],
  'partner-done': [
    { emoji: '👀', title: 'Your partner is ahead.', body: 'They finished up their goals. What about you?' },
    { emoji: '🏃', title: 'Partner completed.', body: 'Your accountability buddy is done. Time to catch up!' },
    { emoji: '💬', title: "Partner is cheering for you.", body: "They've done their part. Time to do yours." },
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
  { text: "It's not about having time, it's about making time.", author: 'Unknown' },
  { text: 'Action is the foundational key to all success.', author: 'Pablo Picasso' },
  { text: 'Progress, not perfection.', author: 'Unknown' },
  { text: 'Do something today that your future self will thank you for.', author: 'Sean Patrick Flanery' },
  { text: 'Work hard in silence; let your success be your noise.', author: 'Frank Ocean' },
  { text: 'Push yourself, because no one else is going to do it for you.', author: 'Unknown' },
  { text: 'Great things never come from comfort zones.', author: 'Unknown' },
  { text: 'The harder you work, the luckier you get.', author: 'Gary Player' },
  { text: 'Momentum matters. Keep going.', author: 'Unknown' },
  { text: 'One step is enough to start.', author: 'Unknown' },
  { text: 'You finished strong today.', author: 'Unknown' },
  { text: 'Every expert was once a beginner.', author: 'Unknown' },
  { text: 'Winners are not people who never fail, but people who never quit.', author: 'Unknown' },
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
  "Focus. You showed up today. That matters.",
  "Keep the streak alive. It's worth protecting.",
  "Progress is progress, no matter how small.",
  "One more task and you're closer to done.",
  "Show up today. That's the whole game.",
  "Every completed goal is a vote for the person you're becoming.",
];

const COMPANION_CHEERING_MESSAGES = [
  "Look at you go. More than halfway there!",
  "You are in the zone. Don't stop now.",
  "Halfway done. Keep this energy going.",
  "You are building something real here. Keep at it.",
];

const COMPANION_DONE_MESSAGES = [
  "Full completion. You did everything today. Outstanding.",
  "Every goal done. That's a perfect day.",
  "You showed up for yourself today. Rest well.",
  "All done. Seriously impressive.",
];

const COMPANION_WAITING_MESSAGES = [
  "No goals yet. Head over to the planner and set some.",
  "A goal without a plan is just a wish. Let's plan.",
  "Set your goals for today. I'll be here to track them.",
];

export function getCompanionMessage(mood?: 'idle' | 'cheering' | 'done' | 'waiting'): string {
  if (mood === 'cheering') return pickByDay(COMPANION_CHEERING_MESSAGES, 13);
  if (mood === 'done') return pickByDay(COMPANION_DONE_MESSAGES, 14);
  if (mood === 'waiting') return pickByDay(COMPANION_WAITING_MESSAGES, 15);
  return pickByDay(COMPANION_IDLE_MESSAGES, 9);
}

// ─────────────────────────────────────────────────────────────────────────────
// Energy / mood messages for today's status card
// ─────────────────────────────────────────────────────────────────────────────

const ENERGY_MESSAGES: Record<ProgressState, string[]> = {
  'no-goals': [
    "Plan something today. Even one goal makes a difference.",
    "A blank day is an opportunity. Fill it with something meaningful.",
  ],
  'no-progress': [
    "One step is enough to start.",
    "Momentum matters. Start with the easiest task.",
    "Beginning is the most important part.",
    "Pick the smallest goal and do it right now.",
  ],
  partial: [
    "Momentum matters. Keep going.",
    "You started. Now finish it.",
    "Progress is happening. Stay consistent.",
    "Half the battle is showing up. You did that.",
  ],
  half: [
    "Halfway is great. Push through the second half.",
    "You are in the zone. Don't lose the momentum now.",
    "50% done. The hardest part is behind you.",
  ],
  'near-done': [
    "Almost there. Don't let up now.",
    "So close. One more push gets you to the finish line.",
    "You have come too far to stop here.",
  ],
  complete: [
    "You finished strong today.",
    "Full day, full effort. Well done.",
    "Every goal done. That compounds over time.",
    "Today was a win. Remember this feeling.",
  ],
};

export function getEnergyMessage(state: ProgressState): string {
  return pickByDay(ENERGY_MESSAGES[state], 16);
}

export function computeProgressState(completedGoals: number, totalGoals: number): ProgressState {
  if (totalGoals === 0) return 'no-goals';
  if (completedGoals === 0) return 'no-progress';
  const pct = (completedGoals / totalGoals) * 100;
  if (pct >= 100) return 'complete';
  if (pct >= 80) return 'near-done';
  if (pct >= 50) return 'half';
  return 'partial';
}

// ─────────────────────────────────────────────────────────────────────────────
// Weekly consistency badges
// ─────────────────────────────────────────────────────────────────────────────

export const WEEKLY_BADGES: WeeklyBadge[] = [
  {
    id: 'strong-start',
    label: 'Strong Start',
    emoji: '🌱',
    description: 'Completed goals on 1-2 days this week.',
    minDaysRequired: 1,
  },
  {
    id: 'momentum-builder',
    label: 'Momentum Builder',
    emoji: '📈',
    description: 'Completed goals on 3-4 days this week.',
    minDaysRequired: 3,
  },
  {
    id: 'weekly-warrior',
    label: 'Weekly Warrior',
    emoji: '⚡',
    description: 'Completed goals on 5-6 days this week.',
    minDaysRequired: 5,
  },
  {
    id: 'power-duo',
    label: 'Power Duo',
    emoji: '🔥',
    description: 'Both partners completed goals 5+ days this week.',
    minDaysRequired: 7,
  },
];

export function getWeeklyBadge(daysCompleted: number, bothPartners = false): WeeklyBadge | null {
  if (daysCompleted === 0) return null;
  if (bothPartners && daysCompleted >= 7) return WEEKLY_BADGES[3];
  if (daysCompleted >= 5) return WEEKLY_BADGES[2];
  if (daysCompleted >= 3) return WEEKLY_BADGES[1];
  return WEEKLY_BADGES[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// End-of-day summary helpers
// ─────────────────────────────────────────────────────────────────────────────

export function buildEndOfDaySummaryTitle(summary: EndOfDaySummary): string {
  if (summary.completionPercent >= 100 && summary.partnerCompleted) {
    return 'Power duo day. Both partners finished.';
  }
  if (summary.completionPercent >= 100) {
    return 'Perfect day. All goals completed.';
  }
  if (summary.completionPercent >= 75) {
    return 'Strong day. Almost everything done.';
  }
  if (summary.completionPercent >= 50) {
    return 'Solid day. You got the important work done.';
  }
  if (summary.completionPercent > 0) {
    return 'You made progress today. That counts.';
  }
  return 'A new day is coming. Tomorrow is a fresh start.';
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

  // All done (check before quarter/halfway/three-quarter)
  if (prev.completedGoals < next.totalGoals && next.completedGoals >= next.totalGoals) {
    if (partnerCompleted) return 'both-done';
    return 'all-done';
  }

  // Crossed 75%
  if (prev.completionPercent < 75 && next.completionPercent >= 75) return 'three-quarter';

  // Crossed 50%
  if (prev.completionPercent < 50 && next.completionPercent >= 50) return 'halfway';

  // Crossed 25%
  if (prev.completionPercent < 25 && next.completionPercent >= 25) return 'quarter';

  // Partner just finished while we also just made progress
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

// ─────────────────────────────────────────────────────────────────────────────
// Preferences helpers (localStorage)
// ─────────────────────────────────────────────────────────────────────────────

const PREFS_KEY = 'studysync-companion-prefs';

export type CompanionPrefs = {
  minimized: boolean;
  reducedMotion: boolean;
};

export function getCompanionPrefs(): CompanionPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<CompanionPrefs>) : {};
    return { minimized: parsed.minimized ?? false, reducedMotion: parsed.reducedMotion ?? false };
  } catch {
    return { minimized: false, reducedMotion: false };
  }
}

export function setCompanionPrefs(prefs: Partial<CompanionPrefs>): void {
  try {
    const current = getCompanionPrefs();
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
  } catch {
    // Ignore
  }
}
