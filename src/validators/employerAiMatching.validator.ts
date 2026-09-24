import { z } from 'zod';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

const optionalBooleanQuery = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    return value === 'true' || value === '1';
  });

export const employerJobMatchQuerySchema = z
  .object({
    minScore: z.coerce.number().int().min(0).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    withAiInsights: optionalBooleanQuery,
  })
  .strict();

export const employerJobMatchParamsSchema = z
  .object({
    id: objectIdSchema,
  })
  .strict();

export const employerJobMatchExplainParamsSchema = z
  .object({
    id: objectIdSchema,
    candidateId: objectIdSchema,
  })
  .strict();

export type EmployerJobMatchQueryInput = z.infer<typeof employerJobMatchQuerySchema>;
