/**
 * Upsert the public hiring catalog without resetting demo subscriptions.
 * Usage: npx ts-node scripts/upsert-hiring-plans.ts
 */
import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { SubscriptionPlan } from '../src/models/SubscriptionPlan';
import { HIRING_PLAN_DEFS } from '../src/seed/data/plans';

async function main(): Promise<void> {
  await mongoose.connect(env.mongodbUri);
  for (const def of HIRING_PLAN_DEFS) {
    await SubscriptionPlan.findOneAndUpdate(
      { slug: def.slug },
      {
        $set: {
          name: def.name,
          slug: def.slug,
          description: def.description,
          price: def.price,
          currency: 'INR',
          billingCycle: def.billingCycle,
          durationDays: def.durationDays,
          features: def.features,
          limits: def.limits,
          status: 'active',
          sortOrder: def.sortOrder,
          catalog: def.catalog,
          hiringIntent: def.hiringIntent,
          offerType: def.offerType,
          monthlyPrice: def.monthlyPrice,
          ...(def.upgradePrice != null ? { upgradePrice: def.upgradePrice } : {}),
          available: def.available,
          popular: def.popular,
          badge: def.badge,
          highlights: def.highlights,
        },
        ...(def.upgradePrice == null ? { $unset: { upgradePrice: 1 as const } } : {}),
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    console.log(`upserted ${def.slug}`);
  }
  await mongoose.disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
