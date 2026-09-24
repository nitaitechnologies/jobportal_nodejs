/**
 * Employer digests: job performance, plan expiry, candidate recommendations.
 * Cron suggestion: daily.
 *
 *   npm run worker:employer-digests
 */
import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { employerDigestService } from '../src/services/employerDigest.service';

async function main() {
  await mongoose.connect(env.mongodbUri);
  const result = await employerDigestService.runDigestPass();
  // eslint-disable-next-line no-console
  console.log('[employer-digests]', result);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error('[employer-digests] failed', error);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
