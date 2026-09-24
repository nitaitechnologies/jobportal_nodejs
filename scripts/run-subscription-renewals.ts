/**
 * Auto-renew due subscriptions (sheet 347 / 412).
 * Cron suggestion: hourly or daily.
 *
 *   npm run worker:subscription-renewals
 *
 * Grace window is configurable via platform setting
 * `subscriptions.autoRenewGraceHours` (default 24).
 */
import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { settingsService } from '../src/services/settings.service';
import { subscriptionService } from '../src/services/subscription.service';

async function main() {
  await mongoose.connect(env.mongodbUri);
  const graceHours = await settingsService.getNumber('subscriptions.autoRenewGraceHours', 24);
  const result = await subscriptionService.processAutoRenewals({ graceHours });
  // eslint-disable-next-line no-console
  console.log('[subscription-renewals]', { graceHours, ...result });
  await mongoose.disconnect();
}

main().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error('[subscription-renewals] failed', error);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
