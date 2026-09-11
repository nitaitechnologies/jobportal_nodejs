import mongoose from 'mongoose';
import type { AuthenticatedEmployer } from '../types/auth.types';
import { Job } from '../models/Job';
import { Subscription } from '../models/Subscription';

export interface PlanLimits {
  jobPostLimit: number;
  activeJobLimit: number;
  featuredJobLimit: number;
  /** Days a listing stays live after publish/renew. 0 = deadline only. */
  jobListingLifetimeDays: number;
}

export interface PlanFeatures {
  featuredJobs: boolean;
  candidateContact: boolean;
}

export interface EmployerEntitlements {
  plan: string;
  planId: string | null;
  subscriptionId: string | null;
  status: 'free' | 'active' | 'trial' | 'expired' | 'cancelled' | 'past_due';
  startDate: Date | null;
  endDate: Date | null;
  features: PlanFeatures;
  limits: PlanLimits;
  usage: {
    jobsPostedInPeriod: number;
    activeJobs: number;
  };
}

/** Sensible free-tier defaults when no paid/trial subscription is active. */
export const FREE_ENTITLEMENTS: Omit<
  EmployerEntitlements,
  'usage' | 'subscriptionId' | 'planId' | 'startDate' | 'endDate'
> = {
  plan: 'free',
  status: 'free',
  features: {
    featuredJobs: false,
    candidateContact: false,
  },
  limits: {
    jobPostLimit: 3,
    activeJobLimit: 2,
    featuredJobLimit: 0,
    jobListingLifetimeDays: 10,
  },
};

const ACTIVE_JOB_STATUSES = ['published', 'paused'] as const;
const LIVE_SUBSCRIPTION_STATUSES = ['active', 'trial'] as const;

export function isSubscriptionCurrentlyActive(subscription: {
  status?: string | null;
  endDate?: Date | null;
}, now = new Date()): boolean {
  if (!subscription.status || !(LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(subscription.status)) {
    return false;
  }
  if (subscription.endDate && subscription.endDate.getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

export async function findCurrentCompanySubscription(companyId: string) {
  const now = new Date();
  const subscription = await Subscription.findOne({
    companyId: new mongoose.Types.ObjectId(companyId),
    status: { $in: [...LIVE_SUBSCRIPTION_STATUSES] },
    $or: [{ endDate: null }, { endDate: { $gt: now } }],
  }).sort({ startDate: -1, createdAt: -1 });

  return subscription;
}

/**
 * Soft-expire live jobs whose expiresAt has passed so activeJobLimit frees up.
 */
export async function markExpiredJobsForCompany(companyId: string, now = new Date()): Promise<number> {
  const result = await Job.updateMany(
    {
      companyId: new mongoose.Types.ObjectId(companyId),
      deletedAt: null,
      status: { $in: [...ACTIVE_JOB_STATUSES] },
      expiresAt: { $ne: null, $lte: now },
    },
    { $set: { status: 'expired' } },
  );
  return result.modifiedCount ?? 0;
}

export async function countActiveJobs(companyId: string): Promise<number> {
  await markExpiredJobsForCompany(companyId);
  return Job.countDocuments({
    companyId: new mongoose.Types.ObjectId(companyId),
    deletedAt: null,
    status: { $in: [...ACTIVE_JOB_STATUSES] },
  });
}

/**
 * Post-quota used: each created job counts as 1, plus each renewal.
 * Free tier (no subscription window): lifetime non-deleted jobs for the company.
 */
export async function countJobsPostedInPeriod(
  companyId: string,
  startDate?: Date | null,
  endDate?: Date | null,
): Promise<number> {
  const match: Record<string, unknown> = {
    companyId: new mongoose.Types.ObjectId(companyId),
    deletedAt: null,
  };

  if (startDate) {
    match.createdAt = {
      $gte: startDate,
      ...(endDate ? { $lte: endDate } : {}),
    };
  }

  const rows = await Job.aggregate<{ total: number }>([
    { $match: match },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $add: [1, { $ifNull: ['$renewalCount', 0] }],
          },
        },
      },
    },
  ]);

  return rows[0]?.total ?? 0;
}

export function canFeatureJob(entitlements: EmployerEntitlements): boolean {
  return (
    entitlements.features.featuredJobs === true ||
    (entitlements.limits.featuredJobLimit ?? 0) > 0
  );
}

function normalizeLimits(raw: Record<string, unknown> | null | undefined): PlanLimits {
  return {
    jobPostLimit: Number(raw?.jobPostLimit ?? FREE_ENTITLEMENTS.limits.jobPostLimit),
    activeJobLimit: Number(raw?.activeJobLimit ?? FREE_ENTITLEMENTS.limits.activeJobLimit),
    featuredJobLimit: Number(raw?.featuredJobLimit ?? FREE_ENTITLEMENTS.limits.featuredJobLimit),
    jobListingLifetimeDays: Number(
      raw?.jobListingLifetimeDays ?? FREE_ENTITLEMENTS.limits.jobListingLifetimeDays,
    ),
  };
}

export async function getEmployerEntitlements(
  employer: AuthenticatedEmployer,
): Promise<EmployerEntitlements> {
  const subscription = await findCurrentCompanySubscription(employer.companyId);

  if (!subscription || !isSubscriptionCurrentlyActive(subscription)) {
    const [jobsPostedInPeriod, activeJobs] = await Promise.all([
      countJobsPostedInPeriod(employer.companyId),
      countActiveJobs(employer.companyId),
    ]);

    return {
      ...FREE_ENTITLEMENTS,
      planId: null,
      subscriptionId: null,
      startDate: null,
      endDate: null,
      usage: { jobsPostedInPeriod, activeJobs },
    };
  }

  const limits = normalizeLimits(subscription.limits as Record<string, unknown> | undefined);

  // Free / zero-price plans without an explicit lifetime still get 10-day listings.
  if (
    (subscription.plan === 'free' || Number(subscription.amount ?? 0) === 0) &&
    !(limits.jobListingLifetimeDays > 0)
  ) {
    limits.jobListingLifetimeDays = FREE_ENTITLEMENTS.limits.jobListingLifetimeDays;
  }

  const featuresRaw = (subscription.features ?? {}) as Record<string, unknown>;
  const features: PlanFeatures = {
    featuredJobs: Boolean(featuresRaw.featuredJobs),
    candidateContact: Boolean(featuresRaw.candidateContact),
  };

  const [jobsPostedInPeriod, activeJobs] = await Promise.all([
    countJobsPostedInPeriod(
      employer.companyId,
      subscription.startDate,
      subscription.endDate ?? undefined,
    ),
    countActiveJobs(employer.companyId),
  ]);

  return {
    plan: subscription.plan,
    planId: subscription.planId ? subscription.planId.toString() : null,
    subscriptionId: subscription._id.toString(),
    status: subscription.status as EmployerEntitlements['status'],
    startDate: subscription.startDate,
    endDate: subscription.endDate ?? null,
    features,
    limits,
    usage: { jobsPostedInPeriod, activeJobs },
  };
}
