import { z } from 'zod';
import { ENTITY_STATUSES } from '../constants/enums';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

export const recruiterTestimonialQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(ENTITY_STATUSES).optional(),
    q: z.string().trim().max(120).optional(),
  })
  .strict();

export const recruiterTestimonialCreateSchema = z
  .object({
    recruiterName: z.string().trim().min(2).max(120),
    companyName: z.string().trim().min(2).max(160),
    roleTitle: z.string().trim().max(120).optional().default(''),
    quote: z.string().trim().min(10).max(2000),
    rating: z.coerce.number().int().min(1).max(5).optional().default(5),
    avatarUrl: z.string().trim().max(1000).optional().default(''),
    status: z.enum(ENTITY_STATUSES).optional().default('inactive'),
    sortOrder: z.number().int().min(0).max(10000).optional().default(0),
  })
  .strict();

export const recruiterTestimonialUpdateSchema = recruiterTestimonialCreateSchema
  .partial()
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
    }
  });

export const recruiterTestimonialIdParamSchema = z.object({ id: objectIdSchema });

export type RecruiterTestimonialQuery = z.infer<typeof recruiterTestimonialQuerySchema>;
export type RecruiterTestimonialCreateInput = z.infer<typeof recruiterTestimonialCreateSchema>;
export type RecruiterTestimonialUpdateInput = z.infer<typeof recruiterTestimonialUpdateSchema>;
