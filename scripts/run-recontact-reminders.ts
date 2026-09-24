/**
 * Future-vacancy re-contact worker (sheet 241).
 *
 *   npm run worker:recontact-reminders
 *
 * Schedule via OS cron, e.g. every 15 minutes:
 *   */15 * * * * cd /path/to/app && npm run worker:recontact-reminders
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { employerCandidateService } from '../src/services/employerCandidate.service';

async function main(): Promise<void> {
  await connectDatabase();
  const result = await employerCandidateService.runRecontactPass();
  console.log('[recontact-reminders] pass complete', JSON.stringify(result));
  await disconnectDatabase();
}

main().catch(async (error: unknown) => {
  const reason = error instanceof Error ? error.message : 'unknown error';
  console.error(`[recontact-reminders] failed: ${reason}`);
  try {
    await disconnectDatabase();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
