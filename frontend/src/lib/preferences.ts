import { useEffect, useState } from 'react';

const SETTINGS_CACHE_KEY = 'studysync-settings-cache';
const SETTINGS_UPDATED_EVENT = 'studysync:settings-updated';

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
