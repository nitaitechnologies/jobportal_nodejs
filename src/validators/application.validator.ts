import { z } from 'zod';
import { APPLICATION_STATUSES } from '../constants/enums';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

export const applicationApplySchema = z
  .object({
    coverLetter: z.string().trim().max(10000).optional().default(''),
    answers: z
      .array(
        z
          .object({
            question: z.string().trim().min(1).max(500),
            answer: z.string().trim().max(5000).optional().default(''),
          })
          .strict(),
      )
      .max(20)
      .optional()
      .default([]),
    /** Optional own resume media:id or http(s) URL; defaults to candidate profile resume. */
    resume: z.string().trim().max(500).optional(),
  })
  .strict();

export const applicationStatusUpdateSchema = z
  .object({
    status: z.enum(APPLICATION_STATUSES),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === 'applied' || value.status === 'withdrawn') {
      ctx.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'Employers cannot set this status through this endpoint',
      });
    }
  });

export const candidateApplicationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(APPLICATION_STATUSES).optional(),
    jobId: objectIdSchema.optional(),
  })
  .strict();

export const employerApplicationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(APPLICATION_STATUSES).optional(),
    jobId: objectIdSchema.optional(),
  })
  .strict();

export const applicationIdParamSchema = z.object({
  id: objectIdSchema,
});

export const jobIdParamSchema = z.object({
  jobId: objectIdSchema,
});

export type ApplicationApplyInput = z.infer<typeof applicationApplySchema>;
export type ApplicationStatusUpdateInput = z.infer<typeof applicationStatusUpdateSchema>;
export type CandidateApplicationQuery = z.infer<typeof candidateApplicationQuerySchema>;
export type EmployerApplicationQuery = z.infer<typeof employerApplicationQuerySchema>;

export const APPLICATION_FORBIDDEN_FIELDS = [
  'candidateId',
  'jobId',
  'employerId',
  'companyId',
  'status',
  'appliedAt',
  'viewedAt',
  'shortlistedAt',
  'rejectedAt',
  'hiredAt',
  'notes',
  'source',
  'createdAt',
  'updatedAt',
  '_id',
  'id',
] as const;
