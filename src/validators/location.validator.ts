import { z } from 'zod';
import { ENTITY_STATUSES, LOCATION_TYPES } from '../constants/enums';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

const slugSchema = z
  .string()
  .trim()
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format');

export const locationCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    type: z.enum(LOCATION_TYPES),
    parentId: objectIdSchema.nullable().optional().default(null),
    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .max(3)
      .regex(/^([A-Z]{2,3})?$/, 'Invalid countryCode')
      .optional()
      .default(''),
    stateCode: z.string().trim().toUpperCase().max(10).optional().default(''),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    status: z.enum(ENTITY_STATUSES).optional().default('active'),
    slug: slugSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.type === 'country' && value.parentId) {
      ctx.addIssue({
        code: 'custom',
        path: ['parentId'],
        message: 'A country cannot have a parent',
      });
    }
    if (value.type !== 'country' && !value.parentId) {
      ctx.addIssue({
        code: 'custom',
        path: ['parentId'],
        message: `${value.type} requires a parentId`,
      });
    }
  });

export const locationUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    type: z.enum(LOCATION_TYPES).optional(),
    parentId: objectIdSchema.nullable().optional(),
    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .max(3)
      .regex(/^([A-Z]{2,3})?$/, 'Invalid countryCode')
      .optional(),
    stateCode: z.string().trim().toUpperCase().max(10).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    status: z.enum(ENTITY_STATUSES).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
    }
  });

export const publicLocationQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  type: z.enum(LOCATION_TYPES).optional(),
  parentId: z.union([objectIdSchema, z.literal('null'), z.literal('root')]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const adminLocationQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  type: z.enum(LOCATION_TYPES).optional(),
  status: z.enum(ENTITY_STATUSES).optional(),
  parentId: z.union([objectIdSchema, z.literal('null'), z.literal('root')]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  sortBy: z.enum(['name', 'type', 'createdAt']).optional().default('name'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export type LocationCreateInput = z.infer<typeof locationCreateSchema>;
export type LocationUpdateInput = z.infer<typeof locationUpdateSchema>;
export type PublicLocationQuery = z.infer<typeof publicLocationQuerySchema>;
export type AdminLocationQuery = z.infer<typeof adminLocationQuerySchema>;

export const LOCATION_FORBIDDEN_FIELDS = ['_id', 'id', 'createdAt', 'updatedAt'] as const;

export const LOCATION_UPDATE_FORBIDDEN_FIELDS = [
  ...LOCATION_FORBIDDEN_FIELDS,
  'slug',
] as const;
