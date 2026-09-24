/**
 * Job listing expiry reminder worker (sheet 227).
 * Soft-expires past-due jobs and notifies employers 3 days before expiry.
 *
 *   npm run worker:job-expiry-reminders
 *
 * Schedule via OS cron, e.g. daily at 09:00:
 *   0 9 * * * cd /path/to/app && npm run worker:job-expiry-reminders
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { jobExpiryReminderService } from '../src/services/jobExpiryReminder.service';

async function main(): Promise<void> {
  await connectDatabase();
  const result = await jobExpiryReminderService.runExpiryReminderPass();
  console.log('[job-expiry-reminders] pass complete', JSON.stringify(result));
  await disconnectDatabase();
}

main().catch(async (error: unknown) => {
  const reason = error instanceof Error ? error.message : 'unknown error';
  console.error(`[job-expiry-reminders] failed: ${reason}`);
  try {
    await disconnectDatabase();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
