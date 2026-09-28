import { z } from 'zod';
import { PAYMENT_KINDS, PAYMENT_STATUSES } from '../constants/enums';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

export const paymentCheckoutSchema = z
  .object({
    kind: z.enum(PAYMENT_KINDS),
    planId: objectIdSchema.optional(),
    creditPackId: z.string().trim().min(1).max(60).optional(),
    couponCode: z.string().trim().max(40).optional().default(''),
    autoRenew: z.boolean().optional().default(false),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === 'subscription' && !value.planId) {
      ctx.addIssue({
        code: 'custom',
        path: ['planId'],
        message: 'planId is required for subscription payments',
      });
    }
    if (value.kind === 'credits' && !value.creditPackId) {
      ctx.addIssue({
        code: 'custom',
        path: ['creditPackId'],
        message: 'creditPackId is required for credit purchases',
      });
    }
  });

export const paymentConfirmSchema = z
  .object({
    /** Simulated provider reference, or Razorpay payment id when the gateway is live. */
    externalPaymentId: z.string().trim().max(120).optional().default(''),
    razorpayOrderId: z.string().trim().max(80).optional().default(''),
    razorpayPaymentId: z.string().trim().max(80).optional().default(''),
    razorpaySignature: z.string().trim().max(256).optional().default(''),
  })
  .strict();

export const paymentFailSchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional().default('Payment failed'),
  })
  .strict();

export const paymentRefundSchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
    amount: z.number().min(0).max(10_000_000).optional(),
  })
  .strict();

export const paymentQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(PAYMENT_STATUSES).optional(),
    kind: z.enum(PAYMENT_KINDS).optional(),
    companyId: objectIdSchema.optional(),
    from: z
      .string()
      .trim()
      .min(8)
      .max(40)
      .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Invalid ISO date' })
      .optional(),
    to: z
      .string()
      .trim()
      .min(8)
      .max(40)
      .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Invalid ISO date' })
      .optional(),
  })
  .strict();

export const paymentRevenueQuerySchema = z
  .object({
    from: z
      .string()
      .trim()
      .min(8)
      .max(40)
      .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Invalid ISO date' })
      .optional(),
    to: z
      .string()
      .trim()
      .min(8)
      .max(40)
      .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Invalid ISO date' })
      .optional(),
  })
  .strict();

export const paymentIdParamSchema = z
  .object({
    id: objectIdSchema,
  })
  .strict();

export const walletTxnQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  })
  .strict();

export const invoiceQuerySchema = walletTxnQuerySchema;

export const invoiceIdParamSchema = paymentIdParamSchema;

export type PaymentCheckoutInput = z.infer<typeof paymentCheckoutSchema>;
export type PaymentConfirmInput = z.infer<typeof paymentConfirmSchema>;
export type PaymentFailInput = z.infer<typeof paymentFailSchema>;
export type PaymentRefundInput = z.infer<typeof paymentRefundSchema>;
export type PaymentQuery = z.infer<typeof paymentQuerySchema>;
export type PaymentRevenueQuery = z.infer<typeof paymentRevenueQuerySchema>;
export type WalletTxnQuery = z.infer<typeof walletTxnQuerySchema>;
export type InvoiceQuery = z.infer<typeof invoiceQuerySchema>;
