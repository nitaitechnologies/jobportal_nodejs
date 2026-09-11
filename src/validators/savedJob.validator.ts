import { z } from 'zod';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

export const savedJobIdParamSchema = z.object({
  jobId: objectIdSchema,
});

export const savedJobListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  })
  .strict();

export type SavedJobIdParam = z.infer<typeof savedJobIdParamSchema>;
export type SavedJobListQuery = z.infer<typeof savedJobListQuerySchema>;
