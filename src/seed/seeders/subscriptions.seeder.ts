import { Subscription } from '../../models/Subscription';
import { SubscriptionPlan } from '../../models/SubscriptionPlan';
import type { SubscriptionStatus } from '../../constants/enums';
import { PLAN_DEFS, planSlug } from '../data/plans';
import { daysAgo, daysFromNow } from '../helpers/dates';
import type { SeedContext, SeedPlanRef } from '../types';

export async function seedSubscriptionPlans(ctx: SeedContext): Promise<void> {
  for (const def of PLAN_DEFS) {
    const slug = planSlug(def.name);
    const plan = await SubscriptionPlan.findOneAndUpdate(
      { slug },
      {
        $set: {
          name: def.name,
          slug,
          description: def.description,
          price: def.price,
          currency: 'INR',
          billingCycle: def.billingCycle,
          durationDays: def.durationDays,
          features: def.features,
          limits: def.limits,
          status: 'active',
          sortOrder: def.sortOrder,
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    ctx.plans.push({
      planId: plan._id,
      slug: plan.slug,
      name: plan.name,
      price: plan.price,
      billingCycle: plan.billingCycle,
      durationDays: plan.durationDays,
      features: def.features,
      limits: def.limits,
    });
  }

  ctx.summary.plans = ctx.plans.length;
}

function planBySlug(ctx: SeedContext, slug: string): SeedPlanRef {
  const found = ctx.plans.find((p) => p.slug === slug);
  if (!found) throw new Error(`Missing plan slug ${slug}`);
  return found;
}

export async function seedSubscriptions(ctx: SeedContext): Promise<void> {
  await Subscription.deleteMany({
    companyId: { $in: ctx.employers.map((e) => e.companyId) },
  });

  let created = 0;
  for (let i = 0; i < ctx.employers.length; i += 1) {
    const employer = ctx.employers[i]!;

    // Employer personas + variety:
    // 0 busy → Professional active near-expiry optional
    // 1 new → Free trial / free
    // 2 paid → Business or Professional active
    // some → expired / cancelled / none-like free
    let plan: SeedPlanRef;
    let status: SubscriptionStatus;
    let startDate = daysAgo(20 + i * 2);
    let endDate = daysFromNow(20);
    let autoRenew = false;

    if (i === 0) {
      plan = planBySlug(ctx, 'professional');
      status = 'active';
      endDate = daysFromNow(12);
      autoRenew = true;
    } else if (i === 1) {
      plan = planBySlug(ctx, 'free');
      status = 'trial';
      startDate = daysAgo(3);
      endDate = daysFromNow(11);
    } else if (i === 2) {
      plan = planBySlug(ctx, 'business');
      status = 'active';
      startDate = daysAgo(40);
      endDate = daysFromNow(320);
      autoRenew = true;
    } else if (i === 3) {
      plan = planBySlug(ctx, 'starter');
      status = 'expired';
      startDate = daysAgo(90);
      endDate = daysAgo(5);
    } else if (i === 4) {
      plan = planBySlug(ctx, 'starter');
      status = 'cancelled';
      startDate = daysAgo(50);
      endDate = daysFromNow(2);
    } else if (i === 5) {
      plan = planBySlug(ctx, 'professional');
      status = 'past_due';
      startDate = daysAgo(40);
      endDate = daysAgo(2);
    } else if (i === ctx.employers.length - 1) {
      // Quiet employer: free / no paid plan
      plan = planBySlug(ctx, 'free');
      status = 'active';
      endDate = daysFromNow(25);
    } else if (i % 3 === 0) {
      plan = planBySlug(ctx, 'starter');
      status = 'active';
      endDate = daysFromNow(3); // near expiry
      autoRenew = false;
    } else {
      plan = planBySlug(ctx, i % 2 === 0 ? 'starter' : 'professional');
      status = 'active';
      autoRenew = i % 2 === 0;
    }

    await Subscription.create({
      userId: employer.userId,
      companyId: employer.companyId,
      planId: plan.planId,
      plan: plan.slug,
      status,
      startDate,
      endDate,
      amount: plan.price,
      currency: 'INR',
      billingCycle: plan.billingCycle,
      autoRenew,
      paymentProvider: '',
      externalSubscriptionId: '',
      features: plan.features,
      limits: plan.limits,
    });
    created += 1;
  }

  ctx.summary.subscriptions = created;
}
