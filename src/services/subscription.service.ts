import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import { Company } from '../models/Company';
import { Employer } from '../models/Employer';
import { Subscription } from '../models/Subscription';
import { SubscriptionPlan } from '../models/SubscriptionPlan';
import { User } from '../models/User';
import type { AuthenticatedEmployer } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { mapEmployerSubscription } from '../utils/subscriptionMapper';
import {
  findCurrentCompanySubscription,
  getEmployerEntitlements,
  isSubscriptionCurrentlyActive,
} from './entitlement.service';
import { resolveCouponPricing } from './coupon.service';
import { trackSafely } from './analytics.service';
import type {
  AdminSubscriptionCreateInput,
  EmployerAutoRenewUpdateInput,
  EmployerSubscriptionQuery,
} from '../validators/subscription.validator';

/**
 * Core activation used by admin assignment, auto-renew, and future payment verification.
 * Dates, status, and price snapshot are always server-controlled.
 */
export async function activateSubscription(input: {
  userId: string;
  companyId: string;
  planId: string;
  autoRenew?: boolean;
  couponCode?: string;
  actorRole?: 'admin' | 'system' | 'employer';
}) {
  const plan = await SubscriptionPlan.findById(input.planId);
  if (!plan) {
    throw new AppError('Subscription plan not found', HTTP_STATUS.NOT_FOUND);
  }
  if (plan.status !== 'active') {
    throw new AppError('Only active plans can be assigned', HTTP_STATUS.BAD_REQUEST);
  }

  const [user, company, employer] = await Promise.all([
    User.findById(input.userId).select('role status deletedAt'),
    Company.findById(input.companyId).select('status'),
    Employer.findOne({ userId: input.userId, companyId: input.companyId }).select('_id status'),
  ]);

  if (!user || user.role !== 'employer' || user.status !== 'active' || user.deletedAt) {
    throw new AppError('Employer user not found', HTTP_STATUS.NOT_FOUND);
  }
  if (!company || company.status === 'suspended') {
    throw new AppError('Company not found or suspended', HTTP_STATUS.BAD_REQUEST);
  }
  if (!employer || employer.status !== 'active') {
    throw new AppError('Employer profile not found for this company', HTTP_STATUS.BAD_REQUEST);
  }

  let amount = plan.price;
  let originalAmount: number | null = null;
  let discountAmount = 0;
  let couponCode = '';

  if (input.couponCode?.trim()) {
    const pricing = await resolveCouponPricing(input.couponCode.trim(), input.planId, {
      consume: true,
    });
    amount = pricing.finalAmount;
    originalAmount = pricing.originalAmount;
    discountAmount = pricing.discountAmount;
    couponCode = pricing.code;
  }

  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

  // End any currently live subscription for this company.
  const previous = await Subscription.findOne({
    companyId: company._id,
    status: { $in: ['active', 'trial'] },
  }).select('_id plan planId');

  await Subscription.updateMany(
    {
      companyId: company._id,
      status: { $in: ['active', 'trial'] },
    },
    {
      $set: { status: 'cancelled' },
    },
  );

  const subscription = await Subscription.create({
    userId: user._id,
    companyId: company._id,
    planId: plan._id,
    plan: plan.slug,
    status: 'active',
    startDate,
    endDate,
    amount,
    originalAmount,
    discountAmount,
    couponCode,
    currency: plan.currency,
    billingCycle: plan.billingCycle,
    autoRenew: Boolean(input.autoRenew),
    features: {
      featuredJobs: plan.features?.featuredJobs ?? false,
      candidateContact: plan.features?.candidateContact ?? false,
      advancedCandidateSearch: plan.features?.advancedCandidateSearch ?? false,
    },
    limits: {
      jobPostLimit: plan.limits?.jobPostLimit ?? 5,
      activeJobLimit: plan.limits?.activeJobLimit ?? 3,
      featuredJobLimit: plan.limits?.featuredJobLimit ?? 0,
      jobListingLifetimeDays: plan.limits?.jobListingLifetimeDays ?? (plan.price === 0 ? 10 : 0),
      contactUnlockLimit: plan.limits?.contactUnlockLimit ?? 0,
      freeSearchResultLimit: plan.limits?.freeSearchResultLimit ?? (plan.price === 0 ? 25 : 0),
    },
    paymentProvider: '',
    externalSubscriptionId: '',
  });

  await trackSafely({
    eventType: previous ? 'subscription_changed' : 'subscription_activated',
    userId: user._id,
    actorRole: input.actorRole ?? 'admin',
    entityType: 'subscription',
    entityId: subscription._id,
    companyId: company._id,
    employerId: employer._id,
    metadata: {
      planId: plan._id.toString(),
      planSlug: plan.slug,
      previousPlan: previous?.plan ?? null,
      couponCode: couponCode || null,
      discountAmount,
      autoRenew: Boolean(input.autoRenew),
    },
  });

  return subscription;
}

export class SubscriptionService {
  async getCurrent(employer: AuthenticatedEmployer) {
    const subscription = await findCurrentCompanySubscription(employer.companyId);
    if (!subscription || !isSubscriptionCurrentlyActive(subscription)) {
      return {
        subscription: null,
        message: 'No active subscription found',
      };
    }
    return {
      subscription: mapEmployerSubscription(subscription),
      message: 'Active subscription fetched successfully',
    };
  }

  async getById(employer: AuthenticatedEmployer, id: string) {
    const subscription = await Subscription.findOne({
      _id: id,
      companyId: employer.companyId,
      userId: employer.userId,
    });
    if (!subscription) {
      throw new AppError('Subscription not found', HTTP_STATUS.NOT_FOUND);
    }
    return { subscription: mapEmployerSubscription(subscription) };
  }

  async listHistory(employer: AuthenticatedEmployer, query: EmployerSubscriptionQuery) {
    const filter: Record<string, unknown> = {
      companyId: new mongoose.Types.ObjectId(employer.companyId),
    };
    if (query.status) {
      filter.status = query.status;
    }

    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      Subscription.countDocuments(filter),
      Subscription.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    ]);

    return {
      subscriptions: rows.map((row) => mapEmployerSubscription(row)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getEntitlements(employer: AuthenticatedEmployer) {
    const entitlements = await getEmployerEntitlements(employer);
    return { entitlements };
  }

  /** Employer toggle for auto-renew on the live company subscription (347). */
  async updateAutoRenew(
    employer: AuthenticatedEmployer,
    input: EmployerAutoRenewUpdateInput,
  ) {
    const subscription = await findCurrentCompanySubscription(employer.companyId);
    if (!subscription || !isSubscriptionCurrentlyActive(subscription)) {
      throw new AppError(
        'No active subscription to update',
        HTTP_STATUS.BAD_REQUEST,
        [{ path: 'autoRenew', message: 'Activate a paid plan before toggling auto-renew' }],
      );
    }

    subscription.autoRenew = input.autoRenew;
    await subscription.save();

    await trackSafely({
      eventType: 'subscription_changed',
      userId: employer.userId,
      actorRole: 'employer',
      entityType: 'subscription',
      entityId: subscription._id,
      companyId: subscription.companyId,
      employerId: employer.employerId,
      metadata: { autoRenew: input.autoRenew },
    });

    return { subscription: mapEmployerSubscription(subscription) };
  }

  /**
   * Extend subscriptions with autoRenew=true that are within the renew window
   * (ended or ending within the next day).
   */
  async processAutoRenewals(opts: { graceHours?: number } = {}) {
    const graceHours = opts.graceHours ?? 24;
    const cutoff = new Date(Date.now() + graceHours * 60 * 60 * 1000);

    const due = await Subscription.find({
      autoRenew: true,
      status: { $in: ['active', 'trial'] },
      planId: { $ne: null },
      endDate: { $ne: null, $lte: cutoff },
    }).limit(200);

    let renewed = 0;
    let failed = 0;

    for (const row of due) {
      if (!row.planId) {
        failed += 1;
        continue;
      }
      try {
        await activateSubscription({
          userId: row.userId.toString(),
          companyId: row.companyId.toString(),
          planId: row.planId.toString(),
          autoRenew: true,
          actorRole: 'system',
        });
        renewed += 1;
      } catch {
        failed += 1;
      }
    }

    return { scanned: due.length, renewed, failed };
  }

  async adminActivate(input: AdminSubscriptionCreateInput) {
    const employer = await Employer.findOne({ companyId: input.companyId }).select('userId status');
    if (!employer || employer.status !== 'active') {
      throw new AppError('Employer not found for this company', HTTP_STATUS.NOT_FOUND);
    }

    const subscription = await activateSubscription({
      userId: employer.userId.toString(),
      companyId: input.companyId,
      planId: input.planId,
      autoRenew: input.autoRenew,
      couponCode: input.couponCode,
      actorRole: 'admin',
    });

    return { subscription: mapEmployerSubscription(subscription) };
  }
}

export const subscriptionService = new SubscriptionService();
