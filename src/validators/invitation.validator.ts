import { z } from 'zod';
import { INVITATION_STATUSES } from '../constants/enums';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

export const invitationCreateSchema = z
  .object({
    candidateId: objectIdSchema,
    jobId: objectIdSchema,
    message: z.string().trim().max(2000).optional().default(''),
    expiresAt: z.coerce.date().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.expiresAt && value.expiresAt.getTime() <= Date.now()) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message: 'expiresAt must be in the future',
      });
    }
  });

export const invitationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(INVITATION_STATUSES).optional(),
    jobId: objectIdSchema.optional(),
  })
  .strict();

export const invitationIdParamSchema = z.object({
  id: objectIdSchema,
});

export type InvitationCreateInput = z.infer<typeof invitationCreateSchema>;
export type InvitationQuery = z.infer<typeof invitationQuerySchema>;

export const INVITATION_FORBIDDEN_FIELDS = [
  'employerId',
  'companyId',
  'status',
  'applicationId',
  'respondedAt',
  'createdAt',
  'updatedAt',
  '_id',
  'id',
] as const;
