import { z } from 'zod';

export const optionalReferralCode = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
  .optional();

export const adminReferralPointsSchema = z
  .object({
    pointsPerSignup: z.coerce.number().int().min(0).max(100000),
  })
  .strict();

export type AdminReferralPointsInput = z.infer<typeof adminReferralPointsSchema>;
