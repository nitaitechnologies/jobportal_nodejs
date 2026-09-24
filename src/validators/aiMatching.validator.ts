import { z } from 'zod';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

export const aiMatchListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
    minScore: z.coerce.number().int().min(0).max(100).optional().default(40),
    withAiInsights: z
      .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
      .optional()
      .transform((value) => {
        if (value === undefined) return true;
        if (typeof value === 'boolean') return value;
        return value === 'true' || value === '1';
      }),
  })
  .strict();

export const aiMatchJobIdParamSchema = z
  .object({
    jobId: objectIdSchema,
  })
  .strict();

export type AiMatchListQuery = z.infer<typeof aiMatchListQuerySchema>;
