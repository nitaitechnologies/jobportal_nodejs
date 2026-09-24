import { z } from 'zod';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

export const improveJdSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(20000).optional().default(''),
    responsibilities: z.array(z.string().trim().min(1).max(500)).max(30).optional().default([]),
    requirements: z.array(z.string().trim().min(1).max(500)).max(30).optional().default([]),
    skills: z.array(z.string().trim().min(1).max(80)).max(40).optional().default([]),
    experienceMin: z.number().min(0).max(50).optional(),
    experienceMax: z.number().min(0).max(50).optional(),
    workMode: z.string().trim().max(40).optional(),
    employmentType: z.string().trim().max(40).optional(),
    tone: z.enum(['professional', 'friendly', 'concise']).optional().default('professional'),
  })
  .strict();

export const suggestSkillsSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(8000).optional().default(''),
    existingSkills: z.array(z.string().trim().min(1).max(80)).max(40).optional().default([]),
    limit: z.number().int().min(3).max(25).optional().default(12),
  })
  .strict();

export const screenCandidatesSchema = z
  .object({
    jobId: objectIdSchema,
    applicationIds: z.array(objectIdSchema).max(30).optional().default([]),
    limit: z.number().int().min(1).max(30).optional().default(15),
  })
  .strict();

export const summarizeProfileSchema = z
  .object({
    candidateId: objectIdSchema.optional(),
    applicationId: objectIdSchema.optional(),
    jobId: objectIdSchema.optional(),
  })
  .strict()
  .refine((v) => Boolean(v.candidateId || v.applicationId), {
    message: 'candidateId or applicationId is required',
  });

export const suggestCandidatesSchema = z
  .object({
    jobId: objectIdSchema,
    limit: z.number().int().min(1).max(30).optional().default(10),
    minScore: z.number().int().min(0).max(100).optional().default(40),
  })
  .strict();

export const generateInterviewQuestionsSchema = z
  .object({
    /** Prefer owned job context when available. */
    jobId: objectIdSchema.optional(),
    /** Free-form AI Interview inputs (sheet 301). */
    role: z.string().trim().min(2).max(200).optional(),
    experienceYears: z.number().min(0).max(50).optional(),
    skills: z.array(z.string().trim().min(1).max(80)).max(30).optional().default([]),
    count: z.number().int().min(3).max(20).optional().default(8),
    difficulty: z.enum(['easy', 'mixed', 'hard']).optional().default('mixed'),
    /** Reuse prior set when regenerating (sheet 303). */
    regenerate: z.boolean().optional().default(false),
    previousQuestions: z
      .array(z.string().trim().min(1).max(500))
      .max(20)
      .optional()
      .default([]),
  })
  .strict()
  .refine((v) => Boolean(v.jobId || v.role?.trim()), {
    message: 'jobId or role is required',
  });

export const saveInterviewQuestionsSchema = z
  .object({
    jobId: objectIdSchema,
    role: z.string().trim().min(2).max(200),
    experienceYears: z.number().min(0).max(50).optional(),
    skills: z.array(z.string().trim().min(1).max(80)).max(30).optional().default([]),
    questions: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(64).optional(),
            text: z.string().trim().min(3).max(500),
            category: z.string().trim().max(80).optional().default('general'),
            difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();

export const generateMessageSchema = z
  .object({
    jobId: objectIdSchema.optional(),
    candidateId: objectIdSchema.optional(),
    applicationId: objectIdSchema.optional(),
    candidateName: z.string().trim().max(120).optional(),
    jobTitle: z.string().trim().max(200).optional(),
    tone: z.enum(['professional', 'friendly', 'concise']).optional().default('professional'),
    notes: z.string().trim().max(1000).optional().default(''),
  })
  .strict();

export type ImproveJdInput = z.infer<typeof improveJdSchema>;
export type SuggestSkillsInput = z.infer<typeof suggestSkillsSchema>;
export type ScreenCandidatesInput = z.infer<typeof screenCandidatesSchema>;
export type SummarizeProfileInput = z.infer<typeof summarizeProfileSchema>;
export type SuggestCandidatesInput = z.infer<typeof suggestCandidatesSchema>;
export type GenerateInterviewQuestionsInput = z.infer<typeof generateInterviewQuestionsSchema>;
export type SaveInterviewQuestionsInput = z.infer<typeof saveInterviewQuestionsSchema>;
export type GenerateMessageInput = z.infer<typeof generateMessageSchema>;
