import { useEffect, useMemo, useState } from 'react';
import { api, type SettingsResponse } from '../lib/api';
import { cacheSettings } from '../lib/preferences';
import { getReducedMotionEnabled, setReducedMotionEnabled } from '../lib/preferences';
import { useAuthStore } from '../store/authStore';

type SettingsDraft = SettingsResponse;

const curatedTimezones = [
  'UTC',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'America/Sao_Paulo',
  'Australia/Sydney',
  'Australia/Perth',
  'Pacific/Auckland',
];

export function SettingsPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);
  const [settings, setSettings] = useState<SettingsDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const timezones = useMemo(() => {
    const current = settings?.profile.timezone;
    if (!current || curatedTimezones.includes(current)) {
      return curatedTimezones;
    }
    return [current, ...curatedTimezones];
  }, [settings?.profile.timezone]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.getSettings(token);
        setSettings(response);
        cacheSettings(response);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load settings.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token]);

  const saveSettings = async () => {
    if (!token || !settings) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.updateSettings(token, {
        profile: {
          name: settings.profile.name,
          timezone: settings.profile.timezone,
          avatarUrl: settings.profile.avatarUrl,
        },
        notificationPreferences: settings.notificationPreferences,
        accountabilityPreferences: settings.accountabilityPreferences,
      });

      if (user) {
        setAuth(token, {
          ...user,
          name: settings.profile.name,
          timezone: settings.profile.timezone,
          avatarUrl: settings.profile.avatarUrl,
          loginMethod: settings.authentication.loginMethod,
        });
      }

      cacheSettings(settings);

      setSuccess('Settings saved successfully.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const applyReminderDefaults = () => {
    if (!settings) {
      return;
    }

    setSettings({
      ...settings,
      notificationPreferences: {
        ...settings.notificationPreferences,
        remindSelfPendingGoals: true,
        remindPartnerPendingGoals: true,
        middayReminderEnabled: true,
        eveningReminderEnabled: true,
        middayReminderTime: '12:00',
        eveningReminderTime: '20:00',
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
      },
      accountabilityPreferences: {
        ...settings.accountabilityPreferences,
        notifyWhenPartnerBehind: true,
        notifyWhenPartnerCompletedAll: true,
        notifyWhenSelfCompletedAll: true,
        realtimePartnerUpdatesEnabled: true,
        dailySummaryEnabled: true,
      },
    });
    setSuccess('Applied recommended defaults. Save to persist.');
  };

  const uploadAvatar = async (file: File) => {
    if (!token || !settings) {
      return;
    }

    setUploadingAvatar(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.uploadAvatar(token, file);
      const updatedSettings = {
        ...settings,
        profile: {
          ...settings.profile,
          avatarUrl: response.avatarUrl,
        },
      };

      setSettings(updatedSettings);
      cacheSettings(updatedSettings);

      if (user) {
        setAuth(token, {
          ...user,
          avatarUrl: response.avatarUrl,
        });
      }

      setSuccess('Profile photo uploaded successfully. Save settings to keep profile fields in sync.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload profile photo.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading || !settings) {
    return (
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h2>
        <p className="mt-3 text-sm text-slate-600">Loading settings...</p>
      </section>
    );
  }

  return (
    <section className="grid gap-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h2>
        <p className="mt-1 text-sm text-slate-600">
          Manage profile, auth provider, reminders, accountability preferences, and workspace context.
        </p>
      </div>

      {error ? <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
      {success ? <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Profile</h3>
          <div className="mt-4 grid gap-3">
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              {settings.profile.avatarUrl ? (
                <img
                  src={settings.profile.avatarUrl}
                  alt={`${settings.profile.name} avatar`}
                  className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                  {settings.profile.name
                    .split(' ')
                    .map((part) => part.trim()[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || 'ME'}
                </span>
              )}
              <div className="grid gap-2">
                <p className="text-sm font-medium text-slate-700">Profile Photo Upload</p>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      uploadAvatar(file);
                    }
                  }}
                  disabled={uploadingAvatar}
                  className="text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                />
                <p className="text-xs text-slate-500">Use JPG, PNG, or WEBP up to 3MB.</p>
              </div>
            </div>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Name</span>
              <input
                value={settings.profile.name}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    profile: { ...settings.profile, name: event.target.value },
                  })
                }
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Email</span>
              <input value={settings.profile.email} disabled className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Timezone</span>
              <select
                value={settings.profile.timezone}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    profile: { ...settings.profile, timezone: event.target.value },
                  })
                }
                className="rounded-lg border border-slate-300 px-3 py-2"
              >
                {timezones.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Profile Photo URL (optional)</span>
              <input
                placeholder="https://..."
                value={settings.profile.avatarUrl ?? ''}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    profile: {
                      ...settings.profile,
                      avatarUrl: event.target.value.trim() ? event.target.value : null,
                    },
                  })
                }
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
              <span className="text-xs text-slate-500">Optional manual URL override.</span>
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Authentication</h3>
          <div className="mt-4 grid gap-3 text-sm text-slate-700">
            <p>
              Current login method:{' '}
              <span className="rounded bg-slate-100 px-2 py-1 font-semibold">
                {settings.authentication.loginMethod}
              </span>
            </p>
            <p>
              Google linked:{' '}
              <span className="font-semibold">{settings.authentication.googleLinked ? 'Yes' : 'No'}</span>
            </p>
            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              You can continue using email/password. Google linking works by signing in with Google using the same email.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Notification Preferences</h3>
        <p className="mt-1 text-sm text-slate-600">
          Control when StudySync should nudge you and how quiet hours suppress reminders.
        </p>
        <div className="mt-3">
          <button
            type="button"
            onClick={applyReminderDefaults}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            Use Recommended Defaults
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Toggle
            label="Remind me about my own pending goals"
            value={settings.notificationPreferences.remindSelfPendingGoals}
            onChange={(value) =>
              setSettings({
                ...settings,
                notificationPreferences: {
                  ...settings.notificationPreferences,
                  remindSelfPendingGoals: value,
                },
              })
            }
          />
          <Toggle
            label="Remind me about my accountability buddy's pending goals"
            value={settings.notificationPreferences.remindPartnerPendingGoals}
            onChange={(value) =>
              setSettings({
                ...settings,
                notificationPreferences: {
                  ...settings.notificationPreferences,
                  remindPartnerPendingGoals: value,
                },
              })
            }
          />
          <Toggle
            label="Send midday reminder"
            value={settings.notificationPreferences.middayReminderEnabled}
            onChange={(value) =>
              setSettings({
                ...settings,
                notificationPreferences: {
                  ...settings.notificationPreferences,
                  middayReminderEnabled: value,
                },
              })
            }
          />
          <Toggle
            label="Send evening reminder"
            value={settings.notificationPreferences.eveningReminderEnabled}
            onChange={(value) =>
              setSettings({
                ...settings,
                notificationPreferences: {
                  ...settings.notificationPreferences,
                  eveningReminderEnabled: value,
                },
              })
            }
          />
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Midday reminder time</span>
            <input
              type="time"
              value={settings.notificationPreferences.middayReminderTime}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  notificationPreferences: {
                    ...settings.notificationPreferences,
                    middayReminderTime: event.target.value,
                  },
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Evening reminder time</span>
            <input
              type="time"
              value={settings.notificationPreferences.eveningReminderTime}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  notificationPreferences: {
                    ...settings.notificationPreferences,
                    eveningReminderTime: event.target.value,
                  },
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <Toggle
            label="Enable quiet hours / do not disturb"
            value={settings.notificationPreferences.quietHoursEnabled}
            onChange={(value) =>
              setSettings({
                ...settings,
                notificationPreferences: {
                  ...settings.notificationPreferences,
                  quietHoursEnabled: value,
                },
              })
            }
          />
          <Toggle
            label="Browser notifications (placeholder)"
            value={settings.notificationPreferences.browserNotificationsEnabled}
            onChange={(value) =>
              setSettings({
                ...settings,
                notificationPreferences: {
                  ...settings.notificationPreferences,
                  browserNotificationsEnabled: value,
                },
              })
            }
          />
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Quiet hours start</span>
            <input
              type="time"
              value={settings.notificationPreferences.quietHoursStart}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  notificationPreferences: {
                    ...settings.notificationPreferences,
                    quietHoursStart: event.target.value,
                  },
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Quiet hours end</span>
            <input
              type="time"
              value={settings.notificationPreferences.quietHoursEnd}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  notificationPreferences: {
                    ...settings.notificationPreferences,
                    quietHoursEnd: event.target.value,
                  },
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Accountability Preferences</h3>
        <p className="mt-1 text-sm text-slate-600">
          Tune accountability buddy nudges, completion celebrations, realtime updates, and daily summaries.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Toggle
            label="Notify me when accountability buddy is behind"
            value={settings.accountabilityPreferences.notifyWhenPartnerBehind}
            onChange={(value) =>
              setSettings({
                ...settings,
                accountabilityPreferences: {
                  ...settings.accountabilityPreferences,
                  notifyWhenPartnerBehind: value,
                },
              })
            }
          />
          <Toggle
            label="Notify me when accountability buddy completes all goals"
            value={settings.accountabilityPreferences.notifyWhenPartnerCompletedAll}
            onChange={(value) =>
              setSettings({
                ...settings,
                accountabilityPreferences: {
                  ...settings.accountabilityPreferences,
                  notifyWhenPartnerCompletedAll: value,
                },
              })
            }
          />
          <Toggle
            label="Notify me when I complete all goals"
            value={settings.accountabilityPreferences.notifyWhenSelfCompletedAll}
            onChange={(value) =>
              setSettings({
                ...settings,
                accountabilityPreferences: {
                  ...settings.accountabilityPreferences,
                  notifyWhenSelfCompletedAll: value,
                },
              })
            }
          />
          <Toggle
            label="Show realtime accountability buddy updates"
            value={settings.accountabilityPreferences.realtimePartnerUpdatesEnabled}
            onChange={(value) =>
              setSettings({
                ...settings,
                accountabilityPreferences: {
                  ...settings.accountabilityPreferences,
                  realtimePartnerUpdatesEnabled: value,
                },
              })
            }
          />
          <Toggle
            label="Daily summary"
            value={settings.accountabilityPreferences.dailySummaryEnabled}
            onChange={(value) =>
              setSettings({
                ...settings,
                accountabilityPreferences: {
                  ...settings.accountabilityPreferences,
                  dailySummaryEnabled: value,
                },
              })
            }
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Daily Accountability Email</h3>
        <p className="mt-1 text-sm text-slate-600">
          Receive a daily email with both your and your accountability buddy's progress. The tone adapts - encouraging when you are on track, a gentle reminder when you need a nudge.
        </p>
        <div className="mt-4 grid gap-4">
          <Toggle
            label="Send me a daily accountability email"
            value={settings.accountabilityPreferences.dailyEmailEnabled}
            onChange={(value) =>
              setSettings({
                ...settings,
                accountabilityPreferences: {
                  ...settings.accountabilityPreferences,
                  dailyEmailEnabled: value,
                },
              })
            }
          />
          {settings.accountabilityPreferences.dailyEmailEnabled && (
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <span className="font-medium">Send at (your timezone - {settings.profile.timezone})</span>
              <input
                type="time"
                value={settings.accountabilityPreferences.dailyEmailTime}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    accountabilityPreferences: {
                      ...settings.accountabilityPreferences,
                      dailyEmailTime: e.target.value,
                    },
                  })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Workspace / Accountability Buddy</h3>
        <div className="mt-4 grid gap-2 text-sm text-slate-700">
          <p>
            Workspace: <span className="font-semibold">{settings.workspace.name}</span>
          </p>
          <p>
            Mode: <span className="font-semibold">{settings.workspace.type}</span>
          </p>
          <p>
            Accountability Buddy: <span className="font-semibold">{settings.workspace.partner?.name ?? 'Not connected yet'}</span>
          </p>
          <p>
            Accountability Buddy Email:{' '}
            <span className="font-semibold">{settings.workspace.partner?.email ?? 'Not available'}</span>
          </p>
          <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            Team mode structure is ready in schema and API, with accountability buddy focused UX currently active.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Animations</h3>
        <p className="mt-1 text-sm text-slate-600">
          Reduce or disable celebration animations if you prefer a simpler experience or have motion sensitivity.
        </p>
        <div className="mt-4">
          <AnimationToggle />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving || uploadingAvatar}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? 'Saving...' : uploadingAvatar ? 'Uploading Photo...' : 'Save Settings'}
        </button>
      </div>
    </section>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
      <span className="text-slate-700">{label}</span>
      <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function AnimationToggle() {
  const [reduced, setReduced] = useState(() => getReducedMotionEnabled());

  const handleChange = (value: boolean) => {
    setReduced(value);
    setReducedMotionEnabled(value);
  };

  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
      <div>
        <span className="font-medium text-slate-700">Reduce celebration animations</span>
        <p className="mt-0.5 text-xs text-slate-500">
          Disables confetti, overlays, sparkles, and progress bar glow effects.
        </p>
      </div>
      <input
        type="checkbox"
        checked={reduced}
        onChange={(event) => handleChange(event.target.checked)}
      />
    </label>
  );
}
