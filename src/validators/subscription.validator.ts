import { z } from 'zod';
import {
  BILLING_CYCLES,
  CURRENCIES,
  PLAN_STATUSES,
  SUBSCRIPTION_STATUSES,
} from '../constants/enums';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

const limitsSchema = z
  .object({
    jobPostLimit: z.number().int().min(0).max(10_000).optional(),
    activeJobLimit: z.number().int().min(0).max(10_000).optional(),
    featuredJobLimit: z.number().int().min(0).max(10_000).optional(),
    /** 0 = no forced listing lifetime (deadline only). Free plans typically use 10. */
    jobListingLifetimeDays: z.number().int().min(0).max(3660).optional(),
  })
  .strict();

const featuresSchema = z
  .object({
    featuredJobs: z.boolean().optional(),
    candidateContact: z.boolean().optional(),
  })
  .strict();

export const subscriptionPlanCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(140)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format')
      .optional(),
    description: z.string().trim().max(2000).optional().default(''),
    price: z.number().min(0).max(10_000_000),
    currency: z.enum(CURRENCIES).optional().default('INR'),
    billingCycle: z.enum(BILLING_CYCLES).optional().default('monthly'),
    durationDays: z.number().int().min(1).max(3660).optional(),
    features: featuresSchema.optional().default({}),
    limits: limitsSchema.optional().default({}),
    sortOrder: z.number().int().min(0).max(10_000).optional().default(0),
    status: z.enum(PLAN_STATUSES).optional().default('active'),
  })
  .strict()
  .transform((value) => {
    const durationDays =
      value.durationDays ??
      (value.billingCycle === 'yearly' ? 365 : value.billingCycle === 'quarterly' ? 90 : 30);
    return { ...value, durationDays };
  });

export const subscriptionPlanUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    price: z.number().min(0).max(10_000_000).optional(),
    currency: z.enum(CURRENCIES).optional(),
    billingCycle: z.enum(BILLING_CYCLES).optional(),
    durationDays: z.number().int().min(1).max(3660).optional(),
    features: featuresSchema.optional(),
    limits: limitsSchema.optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    status: z.enum(PLAN_STATUSES).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
    }
  });

export const publicPlanQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  })
  .strict();

export const adminPlanQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(PLAN_STATUSES).optional(),
    q: z.string().trim().max(100).optional(),
  })
  .strict();

export const adminSubscriptionCreateSchema = z
  .object({
    companyId: objectIdSchema,
    planId: objectIdSchema,
    autoRenew: z.boolean().optional().default(false),
  })
  .strict();

export const employerSubscriptionQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(SUBSCRIPTION_STATUSES).optional(),
  })
  .strict();

export const planIdParamSchema = z.object({ id: objectIdSchema });
export const planSlugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(140)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format'),
});
export const subscriptionIdParamSchema = z.object({ id: objectIdSchema });

export const PLAN_FORBIDDEN_FIELDS = [
  'createdAt',
  'updatedAt',
  '_id',
  'id',
] as const;

export const SUBSCRIPTION_ADMIN_FORBIDDEN_FIELDS = [
  'userId',
  'status',
  'startDate',
  'endDate',
  'amount',
  'currency',
  'billingCycle',
  'features',
  'limits',
  'plan',
  'paymentProvider',
  'externalSubscriptionId',
  'createdAt',
  'updatedAt',
  '_id',
  'id',
] as const;

export type SubscriptionPlanCreateInput = z.infer<typeof subscriptionPlanCreateSchema>;
export type SubscriptionPlanUpdateInput = z.infer<typeof subscriptionPlanUpdateSchema>;
export type PublicPlanQuery = z.infer<typeof publicPlanQuerySchema>;
export type AdminPlanQuery = z.infer<typeof adminPlanQuerySchema>;
export type AdminSubscriptionCreateInput = z.infer<typeof adminSubscriptionCreateSchema>;
export type EmployerSubscriptionQuery = z.infer<typeof employerSubscriptionQuerySchema>;
