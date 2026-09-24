import { z } from 'zod';
import { CANDIDATE_JOB_TYPES, WORK_MODES } from '../constants/enums';
import { RECONTACT_STATUSES } from '../models/RecontactReminder';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

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

const optionalBooleanQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

export const employerCandidateSearchFiltersSchema = z
  .object({
    q: z.string().trim().max(80).optional(),
    skill: z.string().trim().max(80).optional(),
    skills: csvOrArraySchema,
    location: z.string().trim().max(120).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().min(1).max(500).optional(),
    experienceMin: z.coerce.number().min(0).max(60).optional(),
    experienceMax: z.coerce.number().min(0).max(60).optional(),
    education: z.string().trim().max(120).optional(),
    expectedSalaryMin: z.coerce.number().min(0).optional(),
    expectedSalaryMax: z.coerce.number().min(0).optional(),
    jobType: z.enum(CANDIDATE_JOB_TYPES).optional(),
    workMode: z.enum(WORK_MODES).optional(),
    availableBy: z.string().trim().optional(),
    noticePeriodMax: z.coerce.number().min(0).max(365).optional(),
    language: z.string().trim().max(60).optional(),
    isFresher: optionalBooleanQuery,
    openToWork: optionalBooleanQuery,
    jobId: objectIdSchema.optional(),
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
      value.expectedSalaryMin !== undefined &&
      value.expectedSalaryMax !== undefined &&
      value.expectedSalaryMin > value.expectedSalaryMax
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['expectedSalaryMax'],
        message: 'expectedSalaryMax must be >= expectedSalaryMin',
      });
    }
    const hasGeo =
      value.lat !== undefined || value.lng !== undefined || value.radiusKm !== undefined;
    if (hasGeo && (value.lat === undefined || value.lng === undefined || value.radiusKm === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['lat'],
        message: 'lat, lng, and radiusKm are required together for nearby filters',
      });
    }
    if (value.availableBy && Number.isNaN(new Date(value.availableBy).getTime())) {
      ctx.addIssue({
        code: 'custom',
        path: ['availableBy'],
        message: 'availableBy must be a valid date',
      });
    }
  });

export const employerCandidateListQuerySchema = employerCandidateSearchFiltersSchema
  .extend({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const employerCandidateIdParamSchema = z.object({
  id: objectIdSchema,
});

export const employerCandidateDetailQuerySchema = z
  .object({
    jobId: objectIdSchema.optional(),
  })
  .strict();

export const employerCandidateSavedSearchCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    filters: employerCandidateSearchFiltersSchema.optional(),
  })
  .strict();

export const employerCandidateFolderCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional().default(''),
  })
  .strict();

export const employerCandidateFolderUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
    }
  });

export const employerCandidateSavedListQuerySchema = z
  .object({
    folderId: objectIdSchema.optional(),
    tag: z.string().trim().min(1).max(40).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const employerCandidateSaveBodySchema = z
  .object({
    folderId: objectIdSchema.optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
    notes: z.string().trim().max(2000).optional().default(''),
  })
  .strict();

export const employerCandidateUpdateSavedBodySchema = z
  .object({
    folderId: objectIdSchema.nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
    }
  });

export const employerCandidateTagsBodySchema = z
  .object({
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
  })
  .strict();

export const employerCandidateRecontactCreateSchema = z
  .object({
    candidateId: objectIdSchema,
    remindAt: z.coerce.date(),
    note: z.string().trim().max(1000).optional().default(''),
    jobId: objectIdSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.remindAt.getTime() <= Date.now()) {
      ctx.addIssue({
        code: 'custom',
        path: ['remindAt'],
        message: 'remindAt must be in the future',
      });
    }
  });

export const employerCandidateRecontactQuerySchema = z
  .object({
    status: z.enum(RECONTACT_STATUSES).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type EmployerCandidateSearchFiltersInput = z.infer<
  typeof employerCandidateSearchFiltersSchema
>;
export type EmployerCandidateListQuery = z.infer<typeof employerCandidateListQuerySchema>;
export type EmployerCandidateDetailQuery = z.infer<typeof employerCandidateDetailQuerySchema>;
export type EmployerCandidateSavedSearchCreateInput = z.infer<
  typeof employerCandidateSavedSearchCreateSchema
>;
export type EmployerCandidateFolderCreateInput = z.infer<
  typeof employerCandidateFolderCreateSchema
>;
export type EmployerCandidateFolderUpdateInput = z.infer<
  typeof employerCandidateFolderUpdateSchema
>;
export type EmployerCandidateSavedListQuery = z.infer<
  typeof employerCandidateSavedListQuerySchema
>;
export type EmployerCandidateSaveBody = z.infer<typeof employerCandidateSaveBodySchema>;
export type EmployerCandidateUpdateSavedBody = z.infer<
  typeof employerCandidateUpdateSavedBodySchema
>;
export type EmployerCandidateTagsBody = z.infer<typeof employerCandidateTagsBodySchema>;
export type EmployerCandidateRecontactCreateInput = z.infer<
  typeof employerCandidateRecontactCreateSchema
>;
export type EmployerCandidateRecontactQuery = z.infer<
  typeof employerCandidateRecontactQuerySchema
>;

export const EMPLOYER_CANDIDATE_FORBIDDEN_FIELDS = [
  'companyId',
  'employerId',
  'candidateId',
  'createdAt',
  'updatedAt',
  '_id',
  'id',
  'status',
  'sentAt',
  'unlockedAt',
  'creditsSpent',
] as const;
