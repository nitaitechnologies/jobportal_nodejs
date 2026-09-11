import { z } from 'zod';
import { SETTING_VALUE_TYPES } from '../constants/enums';
import { SETTING_GROUPS } from '../constants/platformSettings';

const settingKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z][a-zA-Z0-9._-]*$/, 'Invalid setting key format');

export const adminSettingListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().trim().max(120).optional(),
    group: z.enum(SETTING_GROUPS).optional(),
    type: z.enum(SETTING_VALUE_TYPES).optional(),
    isPublic: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    isActive: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    isEditable: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    sortBy: z.enum(['key', 'group', 'updatedAt', 'createdAt']).optional().default('key'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  })
  .strict();

export const adminSettingCreateSchema = z
  .object({
    key: settingKeySchema,
    value: z.unknown(),
    type: z.enum(SETTING_VALUE_TYPES),
    group: z.enum(SETTING_GROUPS),
    description: z.string().trim().max(500).optional().default(''),
    isPublic: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
    isEditable: z.boolean().optional().default(true),
  })
  .strict();

export const adminSettingUpdateSchema = z
  .object({
    value: z.unknown().optional(),
    description: z.string().trim().max(500).optional(),
    isPublic: z.boolean().optional(),
    group: z.enum(SETTING_GROUPS).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
    }
  });

export const adminSettingStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export const adminSettingKeyParamSchema = z.object({
  key: settingKeySchema,
});

export type AdminSettingListQuery = z.infer<typeof adminSettingListQuerySchema>;
export type AdminSettingCreateInput = z.infer<typeof adminSettingCreateSchema>;
export type AdminSettingUpdateInput = z.infer<typeof adminSettingUpdateSchema>;
export type AdminSettingStatusInput = z.infer<typeof adminSettingStatusSchema>;

export const SETTING_CREATE_FORBIDDEN = [
  '_id',
  'updatedBy',
  'createdAt',
  'updatedAt',
  'isProtected',
] as const;

export const SETTING_UPDATE_FORBIDDEN = [
  '_id',
  'key',
  'type',
  'updatedBy',
  'createdAt',
  'updatedAt',
  'isProtected',
  'isEditable',
  'isActive',
] as const;
