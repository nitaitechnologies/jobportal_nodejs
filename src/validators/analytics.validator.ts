import { z } from 'zod';
import {
  ANALYTICS_ACTOR_ROLES,
  ANALYTICS_DATE_PRESETS,
  ANALYTICS_ENTITY_TYPES,
  ANALYTICS_EVENT_TYPES,
  ANALYTICS_GRANULARITIES,
} from '../constants/enums';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

const isoDateOrDateTime = z
  .string()
  .trim()
  .min(8)
  .max(40)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Invalid ISO date',
  });

const dateRangeFields = {
  preset: z.enum(ANALYTICS_DATE_PRESETS).optional().default('last_30_days'),
  from: isoDateOrDateTime.optional(),
  to: isoDateOrDateTime.optional(),
};

export const adminAnalyticsOverviewQuerySchema = z
  .object({
    ...dateRangeFields,
    granularity: z.enum(ANALYTICS_GRANULARITIES).optional().default('day'),
  })
  .strict();

export const adminAnalyticsEventsQuerySchema = z
  .object({
    ...dateRangeFields,
    eventType: z.enum(ANALYTICS_EVENT_TYPES).optional(),
    actorRole: z.enum(ANALYTICS_ACTOR_ROLES).optional(),
    entityType: z.enum(ANALYTICS_ENTITY_TYPES).optional(),
    jobId: objectIdSchema.optional(),
    employerId: objectIdSchema.optional(),
    candidateId: objectIdSchema.optional(),
    companyId: objectIdSchema.optional(),
    categoryId: objectIdSchema.optional(),
    locationId: objectIdSchema.optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  })
  .strict();

export const adminAnalyticsPagedQuerySchema = z
  .object({
    ...dateRangeFields,
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    sort: z
      .enum(['views', 'applications', 'saves', 'interviews', 'conversion'])
      .optional()
      .default('views'),
  })
  .strict();

export type AdminAnalyticsOverviewQuery = z.infer<typeof adminAnalyticsOverviewQuerySchema>;
export type AdminAnalyticsEventsQuery = z.infer<typeof adminAnalyticsEventsQuerySchema>;
export type AdminAnalyticsPagedQuery = z.infer<typeof adminAnalyticsPagedQuerySchema>;
