import { z } from 'zod';
import { ENTITY_STATUSES } from '../constants/enums';
import { TAXONOMY_KINDS } from '../models/TaxonomyTerm';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

export const taxonomyQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    kind: z.enum(TAXONOMY_KINDS),
    status: z.enum(ENTITY_STATUSES).optional(),
    q: z.string().trim().max(120).optional(),
  })
  .strict();

export const taxonomyCreateSchema = z
  .object({
    kind: z.enum(TAXONOMY_KINDS),
    name: z.string().trim().min(2).max(120),
    slug: z
      .string()
      .trim()
      .max(140)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format')
      .optional(),
    description: z.string().trim().max(2000).optional().default(''),
    status: z.enum(ENTITY_STATUSES).optional().default('active'),
    sortOrder: z.number().int().min(0).max(10000).optional().default(0),
  })
  .strict();

export const taxonomyUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    slug: z
      .string()
      .trim()
      .max(140)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format')
      .optional(),
    description: z.string().trim().max(2000).optional(),
    status: z.enum(ENTITY_STATUSES).optional(),
    sortOrder: z.number().int().min(0).max(10000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
    }
  });

export const taxonomyIdParamSchema = z.object({ id: objectIdSchema });

export type TaxonomyQuery = z.infer<typeof taxonomyQuerySchema>;
export type TaxonomyCreateInput = z.infer<typeof taxonomyCreateSchema>;
export type TaxonomyUpdateInput = z.infer<typeof taxonomyUpdateSchema>;
