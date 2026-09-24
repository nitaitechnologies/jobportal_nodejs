import { z } from 'zod';
import { INTERVIEW_STATUSES, INTERVIEW_TYPES } from '../constants/enums';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

/** Meeting links must be https only (B16). */
const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    if (value === '') {
      return true;
    }
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, {
    message: 'meetingLink must use https',
  });

const durationSchema = z.number().int().min(5).max(480);

function refineScheduleByType(
  value: {
    type: (typeof INTERVIEW_TYPES)[number];
    location?: string;
    meetingLink?: string;
  },
  ctx: z.RefinementCtx,
) {
  if (value.type === 'online' && !value.meetingLink?.trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['meetingLink'],
      message: 'meetingLink is required for online interviews',
    });
  }
  if (value.type === 'onsite' && !value.location?.trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['location'],
      message: 'location is required for onsite interviews',
    });
  }
}

export const interviewCreateSchema = z
  .object({
    applicationId: objectIdSchema,
    scheduledAt: z.coerce.date(),
    duration: durationSchema.optional().default(30),
    type: z.enum(INTERVIEW_TYPES),
    location: z.string().trim().max(500).optional().default(''),
    meetingLink: httpsUrl.optional().default(''),
    interviewer: z.string().trim().max(200).optional().default(''),
    phoneContact: z.string().trim().max(40).optional().default(''),
    notes: z.string().trim().max(5000).optional().default(''),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.scheduledAt.getTime() < Date.now() - 60_000) {
      ctx.addIssue({
        code: 'custom',
        path: ['scheduledAt'],
        message: 'scheduledAt must be in the future',
      });
    }
    refineScheduleByType(value, ctx);
    if (value.type === 'phone' && !value.phoneContact?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['phoneContact'],
        message: 'phoneContact is required for phone interviews',
      });
    }
  });

export const interviewUpdateSchema = z
  .object({
    scheduledAt: z.coerce.date().optional(),
    duration: durationSchema.optional(),
    type: z.enum(INTERVIEW_TYPES).optional(),
    location: z.string().trim().max(500).optional(),
    meetingLink: httpsUrl.optional(),
    interviewer: z.string().trim().max(200).optional(),
    phoneContact: z.string().trim().max(40).optional(),
    notes: z.string().trim().max(5000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one field is required',
      });
    }
    if (value.scheduledAt && value.scheduledAt.getTime() < Date.now() - 60_000) {
      ctx.addIssue({
        code: 'custom',
        path: ['scheduledAt'],
        message: 'scheduledAt must be in the future',
      });
    }
  });

export const interviewRescheduleSchema = z
  .object({
    scheduledAt: z.coerce.date(),
    duration: durationSchema.optional(),
    location: z.string().trim().max(500).optional(),
    meetingLink: httpsUrl.optional(),
    notes: z.string().trim().max(5000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.scheduledAt.getTime() < Date.now() - 60_000) {
      ctx.addIssue({
        code: 'custom',
        path: ['scheduledAt'],
        message: 'scheduledAt must be in the future',
      });
    }
  });

export const interviewCancelSchema = z
  .object({
    cancellationReason: z.string().trim().max(2000).optional().default(''),
  })
  .strict();

export const interviewDeclineSchema = z
  .object({
    cancellationReason: z.string().trim().max(2000).optional().default(''),
  })
  .strict();

/** Employer feedback when marking complete (292). */
export const interviewCompleteSchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    outcome: z.enum(['hire', 'reject', 'hold', 'next_round']).optional(),
    feedbackNotes: z.string().trim().max(5000).optional(),
  })
  .strict();

export const interviewNoShowSchema = z
  .object({
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

export const employerInterviewQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(INTERVIEW_STATUSES).optional(),
    jobId: objectIdSchema.optional(),
    applicationId: objectIdSchema.optional(),
  })
  .strict();

export const candidateInterviewQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(INTERVIEW_STATUSES).optional(),
    /** When true, only active interviews with scheduledAt >= now (upcoming). */
    upcoming: z
      .union([z.literal('true'), z.literal('false'), z.boolean()])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        if (typeof value === 'boolean') return value;
        return value === 'true';
      }),
  })
  .strict();

export const interviewIdParamSchema = z.object({
  id: objectIdSchema,
});

export const INTERVIEW_FORBIDDEN_FIELDS = [
  'candidateId',
  'employerId',
  'companyId',
  'jobId',
  'applicationId',
  'status',
  'createdAt',
  'updatedAt',
  '_id',
  'id',
  'cancellationReason',
  'reminder24hSentAt',
  'reminder1hSentAt',
  'feedback',
] as const;

export type InterviewCreateInput = z.infer<typeof interviewCreateSchema>;
export type InterviewUpdateInput = z.infer<typeof interviewUpdateSchema>;
export type InterviewRescheduleInput = z.infer<typeof interviewRescheduleSchema>;
export type InterviewCancelInput = z.infer<typeof interviewCancelSchema>;
export type InterviewDeclineInput = z.infer<typeof interviewDeclineSchema>;
export type InterviewCompleteInput = z.infer<typeof interviewCompleteSchema>;
export type InterviewNoShowInput = z.infer<typeof interviewNoShowSchema>;
export type EmployerInterviewQuery = z.infer<typeof employerInterviewQuerySchema>;
export type CandidateInterviewQuery = z.infer<typeof candidateInterviewQuerySchema>;
