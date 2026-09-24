import { z } from 'zod';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

export const blockEmployerSchema = z
  .object({
    employerId: objectIdSchema.optional(),
    companyId: objectIdSchema.optional(),
    userId: objectIdSchema.optional(),
    reason: z.string().trim().max(500).optional().default(''),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.employerId && !value.companyId && !value.userId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide employerId, companyId, or userId',
      });
    }
  });

export const candidateDocumentSubmitSchema = z
  .object({
    type: z.enum(['aadhaar', 'pan', 'passport', 'other']),
    mediaUrl: z.string().trim().min(1).max(500),
  })
  .strict();

export type BlockEmployerInput = z.infer<typeof blockEmployerSchema>;
export type CandidateDocumentSubmitInput = z.infer<typeof candidateDocumentSubmitSchema>;
