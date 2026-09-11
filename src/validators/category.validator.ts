import { z } from 'zod';
import { ENTITY_STATUSES } from '../constants/enums';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

export const categoryCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000).optional().default(''),
    icon: z.string().trim().max(500).optional().default(''),
    image: z.string().trim().max(500).optional().default(''),
    parentId: objectIdSchema.nullable().optional().default(null),
    sortOrder: z.number().int().min(0).max(100000).optional().default(0),
    status: z.enum(ENTITY_STATUSES).optional().default('active'),
    slug: z
      .string()
      .trim()
      .max(140)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format')
      .optional(),
  })
  .strict();

export const categoryUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    icon: z.string().trim().max(500).optional(),
    image: z.string().trim().max(500).optional(),
    parentId: objectIdSchema.nullable().optional(),
    sortOrder: z.number().int().min(0).max(100000).optional(),
    status: z.enum(ENTITY_STATUSES).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
    }
  });

export const publicCategoryQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  parentId: z
    .union([objectIdSchema, z.literal('null'), z.literal('root')])
    .optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const adminCategoryQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(ENTITY_STATUSES).optional(),
  parentId: z
    .union([objectIdSchema, z.literal('null'), z.literal('root')])
    .optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  sortBy: z.enum(['sortOrder', 'name', 'createdAt']).optional().default('sortOrder'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
export type PublicCategoryQuery = z.infer<typeof publicCategoryQuerySchema>;
export type AdminCategoryQuery = z.infer<typeof adminCategoryQuerySchema>;

/** Fields clients may never set. Slug is allowed on create (optional) but not on update. */
export const CATEGORY_FORBIDDEN_FIELDS = [
  'jobCount',
  '_id',
  'id',
  'createdAt',
  'updatedAt',
] as const;

export const CATEGORY_UPDATE_FORBIDDEN_FIELDS = [
  ...CATEGORY_FORBIDDEN_FIELDS,
  'slug',
] as const;
