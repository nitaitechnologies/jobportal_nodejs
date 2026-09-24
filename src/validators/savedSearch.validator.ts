import { z } from 'zod';
import { ALERT_FREQUENCIES, EMPLOYMENT_TYPES, WORK_MODES } from '../constants/enums';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

export const savedSearchFiltersSchema = z
  .object({
    q: z.string().trim().max(100).optional().default(''),
    categoryId: objectIdSchema.optional(),
    locationId: objectIdSchema.optional(),
    workMode: z.enum(WORK_MODES).optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
    experienceMin: z.number().min(0).max(50).optional(),
    experienceMax: z.number().min(0).max(50).optional(),
    salaryMin: z.number().min(0).max(100000000).optional(),
    salaryMax: z.number().min(0).max(100000000).optional(),
    featured: z.boolean().optional(),
    urgent: z.boolean().optional(),
    government: z.boolean().optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    radiusKm: z.number().min(1).max(500).optional(),
    skills: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.experienceMin !== undefined &&
      value.experienceMax !== undefined &&
      value.experienceMin > value.experienceMax
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['experienceMax'],
        message: 'experienceMax must be >= experienceMin',
      });
    }
    if (
      value.salaryMin !== undefined &&
      value.salaryMax !== undefined &&
      value.salaryMin > value.salaryMax
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['salaryMax'],
        message: 'salaryMax must be >= salaryMin',
      });
    }
    const hasGeo =
      value.lat !== undefined || value.lng !== undefined || value.radiusKm !== undefined;
    if (hasGeo && (value.lat === undefined || value.lng === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['lat'],
        message: 'lat and lng are required together for nearby filters',
      });
    }
  });

export const savedSearchCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    filters: savedSearchFiltersSchema.optional().default(() => ({
      q: '',
      skills: [],
    })),
    frequency: z.enum(ALERT_FREQUENCIES).optional().default('daily'),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export const savedSearchUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    filters: savedSearchFiltersSchema.optional(),
    frequency: z.enum(ALERT_FREQUENCIES).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
    }
  });

export const savedSearchQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    isActive: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
  })
  .strict();

export const savedSearchIdParamSchema = z.object({
  id: objectIdSchema,
});

export const alertSettingsUpdateSchema = z
  .object({
    matchingJobs: z.boolean().optional(),
    matchScoreMin: z.number().int().min(0).max(100).optional(),
    nearbyJobs: z.boolean().optional(),
    nearbyRadiusKm: z.number().min(1).max(500).optional(),
    salaryAlerts: z.boolean().optional(),
    hotJobs: z.boolean().optional(),
    deadlineAlerts: z.boolean().optional(),
    deadlineDays: z.number().int().min(1).max(30).optional(),
    governmentJobs: z.boolean().optional(),
    digestFrequency: z.enum(ALERT_FREQUENCIES).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
    }
  });

export type SavedSearchFiltersInput = z.infer<typeof savedSearchFiltersSchema>;
export type SavedSearchCreateInput = z.infer<typeof savedSearchCreateSchema>;
export type SavedSearchUpdateInput = z.infer<typeof savedSearchUpdateSchema>;
export type SavedSearchQuery = z.infer<typeof savedSearchQuerySchema>;
export type AlertSettingsUpdateInput = z.infer<typeof alertSettingsUpdateSchema>;

export const SAVED_SEARCH_FORBIDDEN_FIELDS = [
  'candidateId',
  'lastMatchedAt',
  'lastNotifiedAt',
  'createdAt',
  'updatedAt',
  '_id',
  'id',
] as const;
