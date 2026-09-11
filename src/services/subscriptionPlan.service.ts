import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import { SubscriptionPlan } from '../models/SubscriptionPlan';
import { AppError } from '../utils/AppError';
import { createUniqueSlug } from '../utils/slug';
import { mapAdminPlan, mapPublicPlan } from '../utils/subscriptionMapper';
import type {
  AdminPlanQuery,
  PublicPlanQuery,
  SubscriptionPlanCreateInput,
  SubscriptionPlanUpdateInput,
} from '../validators/subscription.validator';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

async function uniquePlanSlug(source: string, excludeId?: string): Promise<string> {
  return createUniqueSlug(source, async (value) => {
    const query: Record<string, unknown> = { slug: value };
    if (excludeId) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }
    return Boolean(await SubscriptionPlan.findOne(query).select('_id'));
  });
}

export class SubscriptionPlanService {
  async listPublic(query: PublicPlanQuery) {
    const { settingsService } = await import('./settings.service.js');
    const plansPublic = await settingsService.getBoolean('subscriptions.plansPublic', true);
    if (!plansPublic) {
      return {
        plans: [],
        pagination: {
          page: query.page,
          limit: query.limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const filter = { status: 'active' as const };
    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      SubscriptionPlan.countDocuments(filter),
      SubscriptionPlan.find(filter)
        .sort({ sortOrder: 1, price: 1, createdAt: 1 })
        .skip(skip)
        .limit(query.limit),
    ]);

    return {
      plans: rows.map((row) => mapPublicPlan(row)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getPublicBySlug(slug: string) {
    const plan = await SubscriptionPlan.findOne({
      slug: slug.toLowerCase(),
      status: 'active',
    });
    if (!plan) {
      throw new AppError('Subscription plan not found', HTTP_STATUS.NOT_FOUND);
    }
    return { plan: mapPublicPlan(plan) };
  }

  async create(input: SubscriptionPlanCreateInput) {
    const slug = await uniquePlanSlug(input.slug?.trim() ? input.slug : input.name);
    try {
      const plan = await SubscriptionPlan.create({
        name: input.name,
        slug,
        description: input.description,
        price: input.price,
        currency: input.currency,
        billingCycle: input.billingCycle,
        durationDays: input.durationDays,
        features: {
          featuredJobs: input.features?.featuredJobs ?? false,
          candidateContact: input.features?.candidateContact ?? false,
        },
        limits: {
          jobPostLimit: input.limits?.jobPostLimit ?? 5,
          activeJobLimit: input.limits?.activeJobLimit ?? 3,
          featuredJobLimit: input.limits?.featuredJobLimit ?? 0,
          jobListingLifetimeDays:
            input.limits?.jobListingLifetimeDays ?? (input.price === 0 ? 10 : 0),
        },
        sortOrder: input.sortOrder,
        status: input.status,
      });
      return { plan: mapAdminPlan(plan) };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AppError('A plan with this slug already exists', HTTP_STATUS.CONFLICT);
      }
      throw error;
    }
  }

  async listAdmin(query: AdminPlanQuery) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.q) {
      const rx = escapeRegex(query.q);
      filter.$or = [
        { name: { $regex: rx, $options: 'i' } },
        { slug: { $regex: rx, $options: 'i' } },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      SubscriptionPlan.countDocuments(filter),
      SubscriptionPlan.find(filter)
        .sort({ sortOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(query.limit),
    ]);

    return {
      plans: rows.map((row) => mapAdminPlan(row)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getAdminById(id: string) {
    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      throw new AppError('Subscription plan not found', HTTP_STATUS.NOT_FOUND);
    }
    return { plan: mapAdminPlan(plan) };
  }

  async update(id: string, input: SubscriptionPlanUpdateInput) {
    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      throw new AppError('Subscription plan not found', HTTP_STATUS.NOT_FOUND);
    }

    if (input.name !== undefined) plan.name = input.name;
    if (input.description !== undefined) plan.description = input.description;
    if (input.price !== undefined) plan.price = input.price;
    if (input.currency !== undefined) plan.currency = input.currency;
    if (input.billingCycle !== undefined) plan.billingCycle = input.billingCycle;
    if (input.durationDays !== undefined) plan.durationDays = input.durationDays;
    if (input.sortOrder !== undefined) plan.sortOrder = input.sortOrder;
    if (input.status !== undefined) plan.status = input.status;
    if (input.features) {
      plan.features = {
        featuredJobs: input.features.featuredJobs ?? plan.features?.featuredJobs ?? false,
        candidateContact:
          input.features.candidateContact ?? plan.features?.candidateContact ?? false,
      };
    }
    if (input.limits) {
      plan.limits = {
        jobPostLimit: input.limits.jobPostLimit ?? plan.limits?.jobPostLimit ?? 5,
        activeJobLimit: input.limits.activeJobLimit ?? plan.limits?.activeJobLimit ?? 3,
        featuredJobLimit: input.limits.featuredJobLimit ?? plan.limits?.featuredJobLimit ?? 0,
        jobListingLifetimeDays:
          input.limits.jobListingLifetimeDays ??
          plan.limits?.jobListingLifetimeDays ??
          (plan.price === 0 ? 10 : 0),
      };
    }

    await plan.save();
    return { plan: mapAdminPlan(plan) };
  }

  async deactivate(id: string) {
    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      throw new AppError('Subscription plan not found', HTTP_STATUS.NOT_FOUND);
    }
    plan.status = 'inactive';
    await plan.save();
    return { plan: mapAdminPlan(plan) };
  }
}

export const subscriptionPlanService = new SubscriptionPlanService();
