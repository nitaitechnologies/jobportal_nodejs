/**
 * Interview reminder worker (24h + 1h before scheduledAt).
 *
 *   npm run worker:interview-reminders
 *
 * Schedule via OS cron, e.g. every 15 minutes:
 *   */15 * * * * cd /path/to/app && npm run worker:interview-reminders
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { interviewReminderService } from '../src/services/interviewReminder.service';

async function main(): Promise<void> {
  await connectDatabase();
  const result = await interviewReminderService.runReminderPass();
  console.log('[interview-reminders] pass complete', JSON.stringify(result));
  await disconnectDatabase();
}

main().catch(async (error: unknown) => {
  const reason = error instanceof Error ? error.message : 'unknown error';
  console.error(`[interview-reminders] failed: ${reason}`);
  try {
    await disconnectDatabase();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
