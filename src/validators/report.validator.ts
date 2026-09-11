import { z } from 'zod';
import {
  REPORT_REASONS,
  REPORT_STATUSES,
  REPORT_TARGET_TYPES,
} from '../constants/enums';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

export const reportCreateSchema = z
  .object({
    targetType: z.enum(REPORT_TARGET_TYPES),
    targetId: objectIdSchema,
    reason: z.enum(REPORT_REASONS),
    description: z.string().trim().max(5000).optional().default(''),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.reason === 'other' && value.description.trim().length < 10) {
      ctx.addIssue({
        code: 'custom',
        path: ['description'],
        message: 'Description is required (min 10 characters) when reason is other',
      });
    }
  });

export const reportAdminUpdateSchema = z
  .object({
    status: z.enum(REPORT_STATUSES).optional(),
    resolution: z.string().trim().max(5000).optional(),
    reviewedBy: objectIdSchema.optional().nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one field is required',
      });
    }
  });

export const userReportQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(REPORT_STATUSES).optional(),
    targetType: z.enum(REPORT_TARGET_TYPES).optional(),
  })
  .strict();

export const adminReportQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(REPORT_STATUSES).optional(),
    targetType: z.enum(REPORT_TARGET_TYPES).optional(),
    reason: z.enum(REPORT_REASONS).optional(),
    sort: z.enum(['latest', 'oldest']).optional().default('latest'),
  })
  .strict();

export const reportIdParamSchema = z.object({
  id: objectIdSchema,
});

export const REPORT_CREATE_FORBIDDEN_FIELDS = [
  'reporterId',
  'userId',
  'status',
  'reviewedBy',
  'reviewedAt',
  'resolution',
  'createdAt',
  'updatedAt',
  '_id',
  'id',
  'priority',
  'internalNotes',
  'adminNotes',
] as const;

export const REPORT_ADMIN_FORBIDDEN_FIELDS = [
  'reporterId',
  'userId',
  'targetType',
  'targetId',
  'reason',
  'description',
  'createdAt',
  'updatedAt',
  'reviewedAt',
  '_id',
  'id',
] as const;

export type ReportCreateInput = z.infer<typeof reportCreateSchema>;
export type ReportAdminUpdateInput = z.infer<typeof reportAdminUpdateSchema>;
export type UserReportQuery = z.infer<typeof userReportQuerySchema>;
export type AdminReportQuery = z.infer<typeof adminReportQuerySchema>;
