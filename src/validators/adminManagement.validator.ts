import { z } from 'zod';
import {
  ACCOUNT_STATUSES,
  ADMIN_ROLES,
  JOB_STATUSES,
  PROFILE_VISIBILITY,
  USER_STATUSES,
  VERIFICATION_STATUSES,
  INTERVIEW_STATUSES,
  INTERVIEW_TYPES,
  APPLICATION_STATUSES,
} from '../constants/enums';
import { ALL_PERMISSIONS } from '../constants/permissions';

export const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

const isoDate = z
  .string()
  .trim()
  .min(8)
  .max(40)
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Invalid ISO date' });

export const adminListQueryBase = {
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().max(120).optional(),
  sortBy: z.string().trim().max(40).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  from: isoDate.optional(),
  to: isoDate.optional(),
};

export const adminIdParamSchema = z.object({ id: objectIdSchema });

// --- Admin users ---
export const adminUserListQuerySchema = z
  .object({
    ...adminListQueryBase,
    email: z.string().trim().email().optional(),
    role: z.enum(ADMIN_ROLES).optional(),
    status: z.enum(ACCOUNT_STATUSES).optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'role', 'status']).optional().default('createdAt'),
  })
  .strict();

export const adminUserCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),
    password: z
      .string()
      .min(8)
      .max(128)
      .refine((value) => /[A-Za-z]/.test(value) && /[0-9]/.test(value), {
        message: 'Password must include at least one letter and one number',
      }),
    role: z.enum(ADMIN_ROLES).optional().default('admin'),
    status: z.enum(ACCOUNT_STATUSES).optional().default('active'),
    permissions: z
      .array(z.string())
      .optional()
      .superRefine((arr, ctx) => {
        if (!arr) return;
        for (let i = 0; i < arr.length; i += 1) {
          if (!(ALL_PERMISSIONS as readonly string[]).includes(arr[i])) {
            ctx.addIssue({
              code: 'custom',
              path: [i],
              message: 'Invalid permission',
            });
          }
        }
      }),
  })
  .strict();

export const adminUserUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().max(254).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
    }
  });

export const adminUserStatusSchema = z
  .object({
    status: z.enum(ACCOUNT_STATUSES),
  })
  .strict();

export const adminUserRoleSchema = z
  .object({
    role: z.enum(ADMIN_ROLES),
    permissions: z
      .array(z.string())
      .optional()
      .superRefine((arr, ctx) => {
        if (!arr) return;
        for (let i = 0; i < arr.length; i += 1) {
          if (!(ALL_PERMISSIONS as readonly string[]).includes(arr[i])) {
            ctx.addIssue({
              code: 'custom',
              path: [i],
              message: 'Invalid permission',
            });
          }
        }
      }),
  })
  .strict();

// --- Candidates ---
export const adminCandidateListQuerySchema = z
  .object({
    ...adminListQueryBase,
    status: z.enum(USER_STATUSES).optional(),
    profileVisibility: z.enum(PROFILE_VISIBILITY).optional(),
    profileCompletionMin: z.coerce.number().int().min(0).max(100).optional(),
    profileCompletionMax: z.coerce.number().int().min(0).max(100).optional(),
    experienceMin: z.coerce.number().min(0).optional(),
    experienceMax: z.coerce.number().min(0).optional(),
    sortBy: z
      .enum(['createdAt', 'updatedAt', 'profileCompletion', 'totalExperience', 'name'])
      .optional()
      .default('createdAt'),
  })
  .strict();

export const adminCandidateStatusSchema = z
  .object({
    status: z.enum(['active', 'inactive', 'suspended']),
  })
  .strict();

export const adminCandidateVisibilitySchema = z
  .object({
    profileVisibility: z.enum(PROFILE_VISIBILITY),
  })
  .strict();

// --- Employers ---
export const adminEmployerListQuerySchema = z
  .object({
    ...adminListQueryBase,
    status: z.enum(ACCOUNT_STATUSES).optional(),
    userStatus: z.enum(USER_STATUSES).optional(),
    email: z.string().trim().email().optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'status']).optional().default('createdAt'),
  })
  .strict();

export const adminEmployerStatusSchema = z
  .object({
    status: z.enum(ACCOUNT_STATUSES),
    userStatus: z.enum(['active', 'inactive', 'suspended']).optional(),
  })
  .strict();

// --- Companies ---
export const adminCompanyListQuerySchema = z
  .object({
    ...adminListQueryBase,
    industry: z.string().trim().max(120).optional(),
    companySize: z.string().trim().max(40).optional(),
    status: z.enum(ACCOUNT_STATUSES).optional(),
    verificationStatus: z.enum(VERIFICATION_STATUSES).optional(),
    sortBy: z
      .enum(['createdAt', 'updatedAt', 'name', 'status', 'verificationStatus'])
      .optional()
      .default('createdAt'),
  })
  .strict();

export const adminCompanyStatusSchema = z
  .object({
    status: z.enum(ACCOUNT_STATUSES),
  })
  .strict();

export const adminCompanyVerificationSchema = z
  .object({
    action: z.enum(['approve', 'reject', 'pending']),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

// --- Jobs ---
export const adminJobListQuerySchema = z
  .object({
    ...adminListQueryBase,
    status: z.enum(JOB_STATUSES).optional(),
    categoryId: objectIdSchema.optional(),
    locationId: objectIdSchema.optional(),
    employerId: objectIdSchema.optional(),
    companyId: objectIdSchema.optional(),
    featured: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    urgent: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    sortBy: z
      .enum(['createdAt', 'updatedAt', 'publishedAt', 'title', 'status', 'views'])
      .optional()
      .default('createdAt'),
  })
  .strict();

export const adminJobStatusSchema = z
  .object({
    status: z.enum(JOB_STATUSES),
    reason: z.string().trim().max(1000).optional(),
  })
  .strict();

export const adminJobFeatureSchema = z
  .object({
    featured: z.boolean(),
  })
  .strict();

export const adminJobUrgentSchema = z
  .object({
    urgent: z.boolean(),
  })
  .strict();

export const adminJobFlagSchema = z
  .object({
    featured: z.boolean().optional(),
    urgent: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.featured === undefined && value.urgent === undefined) {
      ctx.addIssue({ code: 'custom', message: 'featured or urgent is required' });
    }
  });

// --- Applications ---
export const adminApplicationListQuerySchema = z
  .object({
    ...adminListQueryBase,
    status: z.enum(APPLICATION_STATUSES).optional(),
    jobId: objectIdSchema.optional(),
    candidateId: objectIdSchema.optional(),
    employerId: objectIdSchema.optional(),
    companyId: objectIdSchema.optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'appliedAt', 'status']).optional().default('appliedAt'),
  })
  .strict();

// --- Interviews ---
export const adminInterviewListQuerySchema = z
  .object({
    ...adminListQueryBase,
    status: z.enum(INTERVIEW_STATUSES).optional(),
    type: z.enum(INTERVIEW_TYPES).optional(),
    jobId: objectIdSchema.optional(),
    candidateId: objectIdSchema.optional(),
    employerId: objectIdSchema.optional(),
    companyId: objectIdSchema.optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'scheduledAt', 'status']).optional().default('scheduledAt'),
  })
  .strict();

// --- Audit logs ---
export const adminAuditListQuerySchema = z
  .object({
    ...adminListQueryBase,
    action: z.string().trim().max(120).optional(),
    entityType: z.string().trim().max(80).optional(),
    entityId: objectIdSchema.optional(),
    adminUserId: objectIdSchema.optional(),
    sortBy: z.enum(['createdAt']).optional().default('createdAt'),
  })
  .strict();

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
export type AdminUserCreateInput = z.infer<typeof adminUserCreateSchema>;
export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;
export type AdminUserStatusInput = z.infer<typeof adminUserStatusSchema>;
export type AdminUserRoleInput = z.infer<typeof adminUserRoleSchema>;
export type AdminCandidateListQuery = z.infer<typeof adminCandidateListQuerySchema>;
export type AdminCandidateStatusInput = z.infer<typeof adminCandidateStatusSchema>;
export type AdminCandidateVisibilityInput = z.infer<typeof adminCandidateVisibilitySchema>;
export type AdminEmployerListQuery = z.infer<typeof adminEmployerListQuerySchema>;
export type AdminEmployerStatusInput = z.infer<typeof adminEmployerStatusSchema>;
export type AdminCompanyListQuery = z.infer<typeof adminCompanyListQuerySchema>;
export type AdminCompanyStatusInput = z.infer<typeof adminCompanyStatusSchema>;
export type AdminCompanyVerificationInput = z.infer<typeof adminCompanyVerificationSchema>;
export type AdminJobListQuery = z.infer<typeof adminJobListQuerySchema>;
export type AdminJobStatusInput = z.infer<typeof adminJobStatusSchema>;
export type AdminJobFlagInput = z.infer<typeof adminJobFlagSchema>;
export type AdminApplicationListQuery = z.infer<typeof adminApplicationListQuerySchema>;
export type AdminInterviewListQuery = z.infer<typeof adminInterviewListQuerySchema>;
export type AdminAuditListQuery = z.infer<typeof adminAuditListQuerySchema>;

export const ADMIN_USER_CREATE_FORBIDDEN = [
  'passwordHash',
  'userId',
  '_id',
  'createdAt',
  'updatedAt',
  'lastLoginAt',
] as const;
