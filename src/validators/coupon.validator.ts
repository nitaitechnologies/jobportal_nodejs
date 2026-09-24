import { z } from 'zod';
import { COUPON_STATUSES, COUPON_TYPES, CURRENCIES } from '../constants/enums';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

const couponCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid coupon code format')
  .transform((value) => value.toUpperCase());

export const couponCreateSchema = z
  .object({
    code: couponCodeSchema,
    description: z.string().trim().max(500).optional().default(''),
    type: z.enum(COUPON_TYPES),
    value: z.number().min(0).max(10_000_000),
    currency: z.enum(CURRENCIES).optional().default('INR'),
    applicablePlanIds: z.array(objectIdSchema).max(50).optional().default([]),
    minAmount: z.number().min(0).max(10_000_000).optional().default(0),
    maxRedemptions: z.number().int().min(0).max(1_000_000).optional().default(0),
    validFrom: z.coerce.date().optional().nullable(),
    validTo: z.coerce.date().optional().nullable(),
    status: z.enum(COUPON_STATUSES).optional().default('active'),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.type === 'percent' && value.value > 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Percent coupons cannot exceed 100',
      });
    }
    if (value.validFrom && value.validTo && value.validTo < value.validFrom) {
      ctx.addIssue({
        code: 'custom',
        path: ['validTo'],
        message: 'validTo must be on or after validFrom',
      });
    }
  });

export const couponUpdateSchema = z
  .object({
    description: z.string().trim().max(500).optional(),
    type: z.enum(COUPON_TYPES).optional(),
    value: z.number().min(0).max(10_000_000).optional(),
    currency: z.enum(CURRENCIES).optional(),
    applicablePlanIds: z.array(objectIdSchema).max(50).optional(),
    minAmount: z.number().min(0).max(10_000_000).optional(),
    maxRedemptions: z.number().int().min(0).max(1_000_000).optional(),
    validFrom: z.coerce.date().optional().nullable(),
    validTo: z.coerce.date().optional().nullable(),
    status: z.enum(COUPON_STATUSES).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
    }
    if (value.type === 'percent' && typeof value.value === 'number' && value.value > 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Percent coupons cannot exceed 100',
      });
    }
  });

export const couponQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(COUPON_STATUSES).optional(),
    q: z.string().trim().max(80).optional(),
  })
  .strict();

export const couponPreviewSchema = z
  .object({
    code: couponCodeSchema,
    planId: objectIdSchema,
  })
  .strict();

export const couponIdParamSchema = z.object({ id: objectIdSchema });

export const COUPON_FORBIDDEN_FIELDS = [
  'redeemedCount',
  'createdAt',
  'updatedAt',
  '_id',
  'id',
] as const;

export type CouponCreateInput = z.infer<typeof couponCreateSchema>;
export type CouponUpdateInput = z.infer<typeof couponUpdateSchema>;
export type CouponQuery = z.infer<typeof couponQuerySchema>;
export type CouponPreviewInput = z.infer<typeof couponPreviewSchema>;
