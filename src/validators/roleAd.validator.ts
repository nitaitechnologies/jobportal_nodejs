import { z } from 'zod';
import { ENTITY_STATUSES, ROLE_AD_TYPES } from '../constants/enums';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

const urlField = z.string().trim().min(1).max(1000);
const optionalUrlField = z.string().trim().max(1000).optional().default('');

export const roleAdCreateSchema = z
  .object({
    companyName: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).optional().default(''),
    bannerUrl: urlField,
    mobileBannerUrl: optionalUrlField,
    linkUrl: urlField,
    fromDate: z.coerce.date(),
    toDate: z.coerce.date(),
    amount: z.number().min(0).max(100_000_000),
    type: z.enum(ROLE_AD_TYPES),
    categoryIds: z
      .array(objectIdSchema)
      .min(1, 'Select at least one role')
      .max(500, 'You can select at most 500 roles'),
    status: z.enum(ENTITY_STATUSES).optional().default('active'),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.toDate < value.fromDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['toDate'],
        message: 'To date must be on or after from date',
      });
    }
  });

export const roleAdUpdateSchema = z
  .object({
    companyName: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(2000).optional(),
    bannerUrl: urlField.optional(),
    mobileBannerUrl: z.string().trim().max(1000).optional(),
    linkUrl: urlField.optional(),
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),
    amount: z.number().min(0).max(100_000_000).optional(),
    type: z.enum(ROLE_AD_TYPES).optional(),
    categoryIds: z
      .array(objectIdSchema)
      .min(1, 'Select at least one role')
      .max(500, 'You can select at most 500 roles')
      .optional(),
    status: z.enum(ENTITY_STATUSES).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
    }
    if (value.fromDate && value.toDate && value.toDate < value.fromDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['toDate'],
        message: 'To date must be on or after from date',
      });
    }
  });

export const roleAdQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(ENTITY_STATUSES).optional(),
    type: z.enum(ROLE_AD_TYPES).optional(),
    search: z.string().trim().max(120).optional(),
    categoryId: objectIdSchema.optional(),
  })
  .strict();

export const roleAdIdParamSchema = z.object({ id: objectIdSchema });

export const roleAdClickQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  })
  .strict();

export const roleAdSuggestQuerySchema = z
  .object({
    skills: z.string().trim().min(1).max(800),
  })
  .strict();

export type RoleAdCreateInput = z.infer<typeof roleAdCreateSchema>;
export type RoleAdUpdateInput = z.infer<typeof roleAdUpdateSchema>;
export type RoleAdQuery = z.infer<typeof roleAdQuerySchema>;
export type RoleAdClickQuery = z.infer<typeof roleAdClickQuerySchema>;
export type RoleAdSuggestQuery = z.infer<typeof roleAdSuggestQuerySchema>;
