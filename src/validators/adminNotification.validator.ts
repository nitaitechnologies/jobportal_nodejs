import { z } from 'zod';
import { ENTITY_STATUSES, NOTIFICATION_TYPES } from '../constants/enums';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

const isoDate = z
  .string()
  .trim()
  .min(8)
  .max(40)
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Invalid ISO date' });

export const adminNotificationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    type: z.enum(NOTIFICATION_TYPES).optional(),
    audience: z.enum(['candidate', 'employer']).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    boostOnly: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),
  })
  .strict();

export const adminNotificationSendSchema = z
  .object({
    audience: z.enum(['all', 'candidate', 'employer']).optional().default('all'),
    userIds: z.array(objectIdSchema).max(5000).optional(),
    templateKey: z.string().trim().max(80).optional(),
    type: z.enum(NOTIFICATION_TYPES).optional().default('SYSTEM'),
    title: z.string().trim().min(1).max(200).optional(),
    message: z.string().trim().min(1).max(2000).optional(),
    variables: z.record(z.string(), z.string().max(200)).optional(),
    data: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.templateKey && (!value.title || !value.message)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide templateKey or both title and message',
      });
    }
  });

export const notificationTemplateQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    status: z.enum(ENTITY_STATUSES).optional(),
    audience: z.enum(['all', 'candidate', 'employer']).optional(),
  })
  .strict();

export const notificationTemplateCreateSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/, 'Invalid template key'),
    name: z.string().trim().min(2).max(120),
    type: z.enum(NOTIFICATION_TYPES).optional().default('SYSTEM'),
    titleTemplate: z.string().trim().min(1).max(200),
    messageTemplate: z.string().trim().min(1).max(2000),
    audience: z.enum(['all', 'candidate', 'employer']).optional().default('all'),
    status: z.enum(ENTITY_STATUSES).optional().default('active'),
  })
  .strict();

export const notificationTemplateUpdateSchema = notificationTemplateCreateSchema
  .omit({ key: true })
  .partial()
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
    }
  });

export const notificationTemplateIdParamSchema = z.object({ id: objectIdSchema });

export type AdminNotificationQuery = z.infer<typeof adminNotificationQuerySchema>;
export type AdminNotificationSendInput = z.infer<typeof adminNotificationSendSchema>;
export type NotificationTemplateQuery = z.infer<typeof notificationTemplateQuerySchema>;
export type NotificationTemplateCreateInput = z.infer<typeof notificationTemplateCreateSchema>;
export type NotificationTemplateUpdateInput = z.infer<typeof notificationTemplateUpdateSchema>;
