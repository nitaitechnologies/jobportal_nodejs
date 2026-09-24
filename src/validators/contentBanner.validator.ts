import { z } from 'zod';
import { ENTITY_STATUSES } from '../constants/enums';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

const BANNER_PLACEMENTS = ['homepage_hero', 'homepage_secondary', 'jobs_top'] as const;

export const bannerQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(ENTITY_STATUSES).optional(),
    placement: z.enum(BANNER_PLACEMENTS).optional(),
  })
  .strict();

export const bannerCreateSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    subtitle: z.string().trim().max(300).optional().default(''),
    imageUrl: z.string().trim().max(1000).optional().default(''),
    linkUrl: z.string().trim().max(1000).optional().default(''),
    ctaLabel: z.string().trim().max(60).optional().default(''),
    placement: z.enum(BANNER_PLACEMENTS).optional().default('homepage_hero'),
    status: z.enum(ENTITY_STATUSES).optional().default('inactive'),
    sortOrder: z.number().int().min(0).max(10000).optional().default(0),
    startsAt: z.coerce.date().optional().nullable(),
    endsAt: z.coerce.date().optional().nullable(),
  })
  .strict();

export const bannerUpdateSchema = bannerCreateSchema.partial().strict().superRefine((value, ctx) => {
  if (Object.keys(value).length === 0) {
    ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
  }
});

export const bannerIdParamSchema = z.object({ id: objectIdSchema });

export type BannerQuery = z.infer<typeof bannerQuerySchema>;
export type BannerCreateInput = z.infer<typeof bannerCreateSchema>;
export type BannerUpdateInput = z.infer<typeof bannerUpdateSchema>;
