import { z } from 'zod';
import {
  APPLICATION_METHODS,
  EMPLOYMENT_TYPES,
  JOB_STATUSES,
  SALARY_PERIODS,
  WORK_MODES,
} from '../constants/enums';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

const stringListSchema = z.array(z.string().trim().min(1).max(200)).max(50);

const experienceSchema = z
  .object({
    min: z.number().min(0).max(50),
    max: z.number().min(0).max(50).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.max !== undefined && value.max < value.min) {
      ctx.addIssue({
        code: 'custom',
        path: ['max'],
        message: 'experience.max must be greater than or equal to experience.min',
      });
    }
  });

const salarySchema = z
  .object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional(),
    period: z.enum(SALARY_PERIODS).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.min !== undefined && value.max !== undefined && value.max < value.min) {
      ctx.addIssue({
        code: 'custom',
        path: ['max'],
        message: 'salary.max must be greater than or equal to salary.min',
      });
    }
  });

const deadlineSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid deadline date')
  .transform((value) => new Date(value));

export const jobCreateSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().min(20).max(20000),
    responsibilities: stringListSchema.optional().default([]),
    requirements: stringListSchema.optional().default([]),
    skills: stringListSchema.optional().default([]),
    categoryId: objectIdSchema.optional(),
    locationId: objectIdSchema.optional(),
    officePlaceId: z.string().trim().min(3).max(300).optional(),
    workMode: z.enum(WORK_MODES),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    experience: experienceSchema.optional(),
    salary: salarySchema.optional(),
    openings: z.number().int().min(1).max(10000).optional().default(1),
    education: z.string().trim().max(500).optional().default(''),
    genderPreference: z
      .enum(['male', 'female', 'other', 'prefer_not_to_say', 'any'])
      .optional()
      .default('any'),
    benefits: stringListSchema.optional().default([]),
    deadline: deadlineSchema.optional(),
    applicationMethod: z.enum(APPLICATION_METHODS).optional().default('platform'),
  })
  .strict();

export const jobUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().min(20).max(20000).optional(),
    responsibilities: stringListSchema.optional(),
    requirements: stringListSchema.optional(),
    skills: stringListSchema.optional(),
    categoryId: objectIdSchema.nullable().optional(),
    locationId: objectIdSchema.nullable().optional(),
    officePlaceId: z.string().trim().min(3).max(300).nullable().optional(),
    workMode: z.enum(WORK_MODES).optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
    experience: experienceSchema.optional(),
    salary: salarySchema.optional(),
    openings: z.number().int().min(1).max(10000).optional(),
    education: z.string().trim().max(500).optional(),
    genderPreference: z
      .enum(['male', 'female', 'other', 'prefer_not_to_say', 'any'])
      .optional(),
    benefits: stringListSchema.optional(),
    deadline: deadlineSchema.nullable().optional(),
    applicationMethod: z.enum(APPLICATION_METHODS).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
    }
  });

export const employerJobQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(JOB_STATUSES).optional(),
  })
  .strict();

const booleanQuerySchema = z
  .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0'), z.boolean()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    return value === 'true' || value === '1';
  });

/**
 * Public job discovery / search query (B12).
 * Only explicitly listed params are accepted.
 */
export const publicJobQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(100).optional(),
    keyword: z.string().trim().min(1).max(100).optional(),
    category: z.string().trim().min(1).max(140).optional(),
    categoryId: objectIdSchema.optional(),
    location: z.string().trim().min(1).max(140).optional(),
    locationId: objectIdSchema.optional(),
    workMode: z.enum(WORK_MODES).optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
    experienceMin: z.coerce.number().min(0).max(50).optional(),
    experienceMax: z.coerce.number().min(0).max(50).optional(),
    salaryMin: z.coerce.number().min(0).max(100000000).optional(),
    salaryMax: z.coerce.number().min(0).max(100000000).optional(),
    featured: booleanQuerySchema,
    urgent: booleanQuerySchema,
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    sort: z
      .enum(['latest', 'relevance', 'salary_high', 'salary_low', 'experience_low', 'nearest'])
      .optional()
      .default('latest'),
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
        path: ['experienceMin'],
        message: 'experienceMin must be less than or equal to experienceMax',
      });
    }
    if (
      value.salaryMin !== undefined &&
      value.salaryMax !== undefined &&
      value.salaryMin > value.salaryMax
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['salaryMin'],
        message: 'salaryMin must be less than or equal to salaryMax',
      });
    }
    if ((value.lat === undefined) !== (value.lng === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['lat'],
        message: 'lat and lng must be sent together',
      });
    }
    if (value.sort === 'nearest' && (value.lat === undefined || value.lng === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['sort'],
        message: 'nearest sort needs lat and lng',
      });
    }
  })
  .transform((value) => {
    const q = value.q?.trim() || value.keyword?.trim() || undefined;
    return {
      ...value,
      q,
    };
  });

export type JobCreateInput = z.infer<typeof jobCreateSchema>;
export type JobUpdateInput = z.infer<typeof jobUpdateSchema>;
export type EmployerJobQuery = z.infer<typeof employerJobQuerySchema>;
export type PublicJobQuery = z.infer<typeof publicJobQuerySchema>;

/** Fields employers may never set on create/update. */
export const JOB_FORBIDDEN_FIELDS = [
  'employerId',
  'companyId',
  'applicationsCount',
  'views',
  'publishedAt',
  'expiresAt',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'featured',
  'urgent',
  'status',
  'slug',
  '_id',
  'id',
] as const;
