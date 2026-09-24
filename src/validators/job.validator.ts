import { z } from 'zod';
import {
  APPLICATION_METHODS,
  EMPLOYMENT_TYPES,
  JOB_SHIFTS,
  JOB_STATUSES,
  SALARY_PERIODS,
  WORK_MODES,
  WORKING_DAY_PREFERENCES,
} from '../constants/enums';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

const stringListSchema = z.array(z.string().trim().min(1).max(200)).max(50);

/** Accept `a,b` or repeated query keys as string[]. */
const csvOrArraySchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    const parts = (Array.isArray(value) ? value : value.split(','))
      .flatMap((item) => item.split(','))
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 20);
    return parts.length ? parts : undefined;
  });

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

const screeningQuestionSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    text: z.string().trim().min(3).max(500),
    required: z.boolean().optional().default(false),
    type: z
      .enum(['text', 'experience', 'salary', 'joining', 'skill'])
      .optional()
      .default('text'),
  })
  .strict();

const screeningAutoFilterSchema = z
  .object({
    enabled: z.boolean().optional().default(false),
    minMatchScore: z.number().min(0).max(100).optional().default(40),
  })
  .strict();

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
    shift: z.enum(JOB_SHIFTS).optional(),
    workingDays: z.array(z.enum(WORKING_DAY_PREFERENCES)).max(3).optional().default([]),
    workingHours: z.string().trim().max(120).optional().default(''),
    genderPreference: z
      .enum(['male', 'female', 'other', 'prefer_not_to_say', 'any'])
      .optional()
      .default('any'),
    benefits: stringListSchema.optional().default([]),
    incentives: z.boolean().optional().default(false),
    interviewProcess: z.string().trim().max(2000).optional().default(''),
    deadline: deadlineSchema.optional(),
    applicationMethod: z.enum(APPLICATION_METHODS).optional().default('platform'),
    urgent: z.boolean().optional().default(false),
    screeningQuestions: z.array(screeningQuestionSchema).max(20).optional().default([]),
    screeningAutoFilter: screeningAutoFilterSchema.optional(),
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
    shift: z.enum(JOB_SHIFTS).nullable().optional(),
    workingDays: z.array(z.enum(WORKING_DAY_PREFERENCES)).max(3).optional(),
    workingHours: z.string().trim().max(120).nullable().optional(),
    genderPreference: z
      .enum(['male', 'female', 'other', 'prefer_not_to_say', 'any'])
      .optional(),
    benefits: stringListSchema.optional(),
    incentives: z.boolean().optional(),
    interviewProcess: z.string().trim().max(2000).nullable().optional(),
    deadline: deadlineSchema.nullable().optional(),
    applicationMethod: z.enum(APPLICATION_METHODS).optional(),
    urgent: z.boolean().optional(),
    screeningQuestions: z.array(screeningQuestionSchema).max(20).optional(),
    screeningAutoFilter: screeningAutoFilterSchema.optional(),
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
    verified: booleanQuerySchema,
    easyApply: booleanQuerySchema,
    /**
     * Fresher Mode presets (sheet 149–156).
     * Empty matches still return 200 with jobs: [].
     */
    fresherMode: z
      .enum([
        'fresher',
        'internship',
        'no-experience',
        'training',
        'entry-level',
        'graduate',
        '10th',
        '12th',
      ])
      .optional(),
    education: csvOrArraySchema,
    skills: csvOrArraySchema,
    industry: z.string().trim().min(1).max(140).optional(),
    companyId: objectIdSchema.optional(),
    company: z.string().trim().min(1).max(140).optional(),
    companySlug: z.string().trim().min(1).max(140).optional(),
    postedWithinDays: z.coerce.number().int().min(1).max(365).optional(),
    shift: z.enum(JOB_SHIFTS).optional(),
    workingDays: csvOrArraySchema,
    radiusKm: z.coerce.number().min(1).max(500).optional(),
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
    if (value.radiusKm !== undefined && (value.lat === undefined || value.lng === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['radiusKm'],
        message: 'radiusKm needs lat and lng',
      });
    }
    if (value.workingDays?.length) {
      const allowed = new Set<string>(WORKING_DAY_PREFERENCES);
      for (const day of value.workingDays) {
        if (!allowed.has(day)) {
          ctx.addIssue({
            code: 'custom',
            path: ['workingDays'],
            message: `Invalid working day: ${day}`,
          });
        }
      }
    }
  })
  .transform((value) => {
    const q = value.q?.trim() || value.keyword?.trim() || undefined;
    const companySlug = value.companySlug?.trim() || value.company?.trim() || undefined;
    return {
      ...value,
      q,
      companySlug,
    };
  });

export type JobCreateInput = z.infer<typeof jobCreateSchema>;
export type JobUpdateInput = z.infer<typeof jobUpdateSchema>;
export type EmployerJobQuery = z.infer<typeof employerJobQuerySchema>;
export type PublicJobQuery = z.infer<typeof publicJobQuerySchema>;

export const jobExtendSchema = z
  .object({
    days: z.number().int().min(1).max(90).optional(),
  })
  .strict();

export const jobFeatureSchema = z
  .object({
    featured: z.boolean(),
  })
  .strict();

export const jobUrgentFlagSchema = z
  .object({
    urgent: z.boolean(),
  })
  .strict();

/** Boost notify to matching candidates (318–319). */
export const jobBoostNotifySchema = z
  .object({
    minScore: z.coerce.number().int().min(1).max(100).optional().default(60),
    limit: z.coerce.number().int().min(1).max(80).optional().default(40),
  })
  .strict();

export type JobExtendInput = z.infer<typeof jobExtendSchema>;
export type JobFeatureInput = z.infer<typeof jobFeatureSchema>;
export type JobUrgentFlagInput = z.infer<typeof jobUrgentFlagSchema>;
export type JobBoostNotifyInput = z.infer<typeof jobBoostNotifySchema>;

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
  'status',
  'slug',
  '_id',
  'id',
  'expiryReminderSentAt',
  'renewalCount',
  'lastRenewedAt',
] as const;
