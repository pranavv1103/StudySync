import { useEffect, useState } from 'react';

const SETTINGS_CACHE_KEY = 'studysync-settings-cache';
const SETTINGS_UPDATED_EVENT = 'studysync:settings-updated';
const COMPANION_PREFS_KEY = 'studysync-companion-prefs';
export const COMPANION_PREFS_UPDATED_EVENT = 'studysync:prefs-updated';

type CachedSettings = {
  accountabilityPreferences?: {
    realtimePartnerUpdatesEnabled?: boolean;
  };
};

function parseCachedSettings(): CachedSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as CachedSettings;
  } catch {
    return null;
  }
}

function notifySettingsUpdated() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
}

export function cacheSettings(settings: unknown) {
  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
    notifySettingsUpdated();
  } catch {
    // Ignore cache write errors.
  }
}

export function getRealtimeUpdatesEnabled(): boolean {
  const parsed = parseCachedSettings();
  return parsed?.accountabilityPreferences?.realtimePartnerUpdatesEnabled ?? true;
}

export function useRealtimeUpdatesEnabled(): boolean {
  const [enabled, setEnabled] = useState(() => getRealtimeUpdatesEnabled());

  useEffect(() => {
    const sync = () => setEnabled(getRealtimeUpdatesEnabled());

    window.addEventListener('storage', sync);
    window.addEventListener(SETTINGS_UPDATED_EVENT, sync);

    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(SETTINGS_UPDATED_EVENT, sync);
    };
  }, []);

  return enabled;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reduced-motion preference (respects OS setting + user toggle)
// ─────────────────────────────────────────────────────────────────────────────

function readReducedMotionPref(): boolean {
  const mediaReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (mediaReduced) return true;
  try {
    const raw = localStorage.getItem(COMPANION_PREFS_KEY);
    const parsed = raw ? (JSON.parse(raw) as { reducedMotion?: boolean }) : {};
    return parsed.reducedMotion ?? false;
  } catch {
    return false;
  }
}

export function getReducedMotionEnabled(): boolean {
  return readReducedMotionPref();
}

export function setReducedMotionEnabled(value: boolean): void {
  try {
    const raw = localStorage.getItem(COMPANION_PREFS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    localStorage.setItem(COMPANION_PREFS_KEY, JSON.stringify({ ...parsed, reducedMotion: value }));
    window.dispatchEvent(new Event(COMPANION_PREFS_UPDATED_EVENT));
  } catch {
    // ignore
  }
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => readReducedMotionPref());

  useEffect(() => {
    const sync = () => setReduced(readReducedMotionPref());

    window.addEventListener('storage', sync);
    window.addEventListener(COMPANION_PREFS_UPDATED_EVENT, sync);

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', sync);

    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(COMPANION_PREFS_UPDATED_EVENT, sync);
      mq.removeEventListener('change', sync);
    };
  }, []);

  return reduced;
}
