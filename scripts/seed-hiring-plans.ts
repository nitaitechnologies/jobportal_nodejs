/**
 * Upsert WorkIndia-style hiring catalog plans (single/multi city).
 *   npx ts-node scripts/seed-hiring-plans.ts
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { createSeedContext } from '../src/seed/context';
import { seedSubscriptionPlans } from '../src/seed/seeders/subscriptions.seeder';
import { SubscriptionPlan } from '../src/models/SubscriptionPlan';

async function main() {
  await connectDatabase();
  const ctx = createSeedContext();
  await seedSubscriptionPlans(ctx);

  // Ensure 1-month single city is buyable on the pricing page.
  await SubscriptionPlan.updateOne(
    { slug: 'single-1-month' },
    { $set: { available: true } },
  );

  const hiring = await SubscriptionPlan.find({ catalog: 'hiring', status: 'active' })
    .select('slug name price available hiringIntent')
    .sort({ sortOrder: 1 })
    .lean();

  console.log(`Seeded plans. Hiring catalog count: ${hiring.length}`);
  for (const plan of hiring) {
    console.log(
      ` - ${plan.slug} | ${plan.name} | ₹${plan.price} | ${plan.hiringIntent} | available=${plan.available}`,
    );
  }

  await disconnectDatabase();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await disconnectDatabase();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
