import type { Types } from 'mongoose';

export interface PlanLike {
  _id: Types.ObjectId | { toString(): string };
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  currency?: string | null;
  billingCycle?: string | null;
  durationDays?: number | null;
  features?: Record<string, unknown> | null;
  limits?: Record<string, unknown> | null;
  status?: string;
  sortOrder?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SubscriptionLike {
  _id: Types.ObjectId | { toString(): string };
  userId: Types.ObjectId | { toString(): string };
  companyId: Types.ObjectId | { toString(): string };
  planId?: Types.ObjectId | { toString(): string } | null;
  plan: string;
  status?: string;
  startDate: Date;
  endDate?: Date | null;
  amount?: number | null;
  currency?: string | null;
  billingCycle?: string | null;
  autoRenew?: boolean | null;
  features?: Record<string, unknown> | null;
  limits?: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export function mapPublicPlan(plan: PlanLike) {
  return {
    id: plan._id.toString(),
    name: plan.name,
    slug: plan.slug,
    description: plan.description ?? '',
    price: plan.price,
    currency: plan.currency ?? 'INR',
    billingCycle: plan.billingCycle ?? 'monthly',
    durationDays: plan.durationDays ?? 30,
    features: plan.features ?? {},
    limits: plan.limits ?? {},
    sortOrder: plan.sortOrder ?? 0,
  };
}

export function mapAdminPlan(plan: PlanLike) {
  return {
    ...mapPublicPlan(plan),
    status: plan.status ?? 'active',
    createdAt: plan.createdAt ?? null,
    updatedAt: plan.updatedAt ?? null,
  };
}

export function mapEmployerSubscription(subscription: SubscriptionLike) {
  return {
    id: subscription._id.toString(),
    companyId: subscription.companyId.toString(),
    planId: subscription.planId ? subscription.planId.toString() : null,
    plan: subscription.plan,
    status: subscription.status ?? 'trial',
    startDate: subscription.startDate,
    endDate: subscription.endDate ?? null,
    amount: subscription.amount ?? 0,
    currency: subscription.currency ?? 'INR',
    billingCycle: subscription.billingCycle ?? 'monthly',
    autoRenew: Boolean(subscription.autoRenew),
    features: subscription.features ?? {},
    limits: subscription.limits ?? {},
    createdAt: subscription.createdAt ?? null,
    updatedAt: subscription.updatedAt ?? null,
  };
}
