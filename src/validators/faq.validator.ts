import { z } from 'zod';
import { ENTITY_STATUSES } from '../constants/enums';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

const FAQ_CATEGORIES = ['general', 'candidate', 'employer', 'payments', 'safety'] as const;

export const faqQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(ENTITY_STATUSES).optional(),
    category: z.enum(FAQ_CATEGORIES).optional(),
    q: z.string().trim().max(120).optional(),
  })
  .strict();

export const faqCreateSchema = z
  .object({
    question: z.string().trim().min(5).max(300),
    answer: z.string().trim().min(5).max(10000),
    slug: z
      .string()
      .trim()
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format')
      .optional(),
    category: z.enum(FAQ_CATEGORIES).optional().default('general'),
    status: z.enum(ENTITY_STATUSES).optional().default('inactive'),
    sortOrder: z.number().int().min(0).max(10000).optional().default(0),
  })
  .strict();

export const faqUpdateSchema = faqCreateSchema.partial().strict().superRefine((value, ctx) => {
  if (Object.keys(value).length === 0) {
    ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
  }
});

export const faqIdParamSchema = z.object({ id: objectIdSchema });

export type FaqQuery = z.infer<typeof faqQuerySchema>;
export type FaqCreateInput = z.infer<typeof faqCreateSchema>;
export type FaqUpdateInput = z.infer<typeof faqUpdateSchema>;
