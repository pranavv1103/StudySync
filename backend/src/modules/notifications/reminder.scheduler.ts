import cron from 'node-cron';
import { runPreferenceBasedReminderSweep } from './notification.service.js';

export function startReminderSchedulers() {
  cron.schedule('*/5 * * * *', async () => {
    await runPreferenceBasedReminderSweep(new Date());
  });

  console.log('Reminder scheduler active every 5 minutes with user preference times.');
}
