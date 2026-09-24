/**
 * Job alerts digester (daily/weekly + deadline reminders).
 *
 *   npm run worker:alerts
 *
 * Schedule via OS cron, e.g. every hour:
 *   0 * * * * cd /path/to/app && npm run worker:alerts
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { jobAlertService } from '../src/services/jobAlert.service';

async function main(): Promise<void> {
  await connectDatabase();
  const result = await jobAlertService.runScheduledPass();
  console.log('[job-alerts] scheduled pass complete', JSON.stringify(result));
  await disconnectDatabase();
}

main().catch(async (error: unknown) => {
  const reason = error instanceof Error ? error.message : 'unknown error';
  console.error(`[job-alerts] failed: ${reason}`);
  try {
    await disconnectDatabase();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
