import { z } from 'zod';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

const grantsSchema = z
  .object({
    jobPosts: z.number().int().min(0).max(100_000),
    boosts: z.number().int().min(0).max(100_000),
    unlocks: z.number().int().min(0).max(1_000_000),
    createdPoints: z.number().int().min(0).max(1_000_000).optional().default(0),
  })
  .strict();

export const cityPackageCreateSchema = z
  .object({
    city: z.string().trim().min(2).max(80),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).optional().default(''),
    price: z.number().min(0).max(10_000_000),
    durationDays: z.number().int().min(1).max(366).optional().default(30),
    sortOrder: z.number().int().min(1).max(4).optional().default(1),
    grants: grantsSchema,
  })
  .strict();

export const cityPackageUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    price: z.number().min(0).max(10_000_000).optional(),
    durationDays: z.number().int().min(1).max(366).optional(),
    sortOrder: z.number().int().min(1).max(4).optional(),
    status: z.enum(['active', 'inactive']).optional(),
    grants: grantsSchema.optional(),
  })
  .strict();

export const customProposalCreateSchema = z
  .object({
    companyId: objectIdSchema,
    title: z.string().trim().min(2).max(120),
    note: z.string().trim().max(1000).optional().default(''),
    price: z.number().min(0).max(10_000_000),
    durationDays: z.number().int().min(1).max(366).optional().default(30),
    grants: grantsSchema,
  })
  .strict();

export type CityPackageCreateInput = z.infer<typeof cityPackageCreateSchema>;
export type CityPackageUpdateInput = z.infer<typeof cityPackageUpdateSchema>;
export type CustomProposalCreateInput = z.infer<typeof customProposalCreateSchema>;
