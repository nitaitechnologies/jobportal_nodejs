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
import { trackSafely } from './analytics.service';
import type {
  AdminSubscriptionCreateInput,
  EmployerSubscriptionQuery,
} from '../validators/subscription.validator';

/**
 * Core activation used by admin assignment and future payment verification.
 * Dates, status, and price snapshot are always server-controlled.
 */
export async function activateSubscription(input: {
  userId: string;
  companyId: string;
  planId: string;
  autoRenew?: boolean;
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
    amount: plan.price,
    currency: plan.currency,
    billingCycle: plan.billingCycle,
    autoRenew: Boolean(input.autoRenew),
    features: {
      featuredJobs: plan.features?.featuredJobs ?? false,
      candidateContact: plan.features?.candidateContact ?? false,
    },
    limits: {
      jobPostLimit: plan.limits?.jobPostLimit ?? 5,
      activeJobLimit: plan.limits?.activeJobLimit ?? 3,
      featuredJobLimit: plan.limits?.featuredJobLimit ?? 0,
      jobListingLifetimeDays: plan.limits?.jobListingLifetimeDays ?? (plan.price === 0 ? 10 : 0),
    },
    paymentProvider: '',
    externalSubscriptionId: '',
  });

  await trackSafely({
    eventType: previous ? 'subscription_changed' : 'subscription_activated',
    userId: user._id,
    actorRole: 'admin',
    entityType: 'subscription',
    entityId: subscription._id,
    companyId: company._id,
    employerId: employer._id,
    metadata: {
      planId: plan._id.toString(),
      planSlug: plan.slug,
      previousPlan: previous?.plan ?? null,
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
    });

    return { subscription: mapEmployerSubscription(subscription) };
  }
}

export const subscriptionService = new SubscriptionService();
