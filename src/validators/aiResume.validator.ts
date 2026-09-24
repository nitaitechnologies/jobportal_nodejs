import { z } from 'zod';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

export const aiResumeBuildSchema = z
  .object({
    tone: z.enum(['professional', 'friendly', 'concise']).optional().default('professional'),
    focusRoles: z.array(z.string().trim().min(1).max(80)).max(5).optional().default([]),
  })
  .strict();

export const aiResumeTailorSchema = z
  .object({
    jobId: objectIdSchema,
    tone: z.enum(['professional', 'friendly', 'concise']).optional().default('professional'),
  })
  .strict();

export type AiResumeBuildInput = z.infer<typeof aiResumeBuildSchema>;
export type AiResumeTailorInput = z.infer<typeof aiResumeTailorSchema>;
