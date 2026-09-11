import { z } from 'zod';
import { NOTIFICATION_TYPES } from '../constants/enums';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

const booleanQuerySchema = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((value) => {
    if (typeof value === 'boolean') {
      return value;
    }
    return value === 'true' || value === '1';
  });

export const notificationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    isRead: booleanQuerySchema.optional(),
    type: z.enum(NOTIFICATION_TYPES).optional(),
  })
  .strict();

export const notificationIdParamSchema = z.object({
  id: objectIdSchema,
});

export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
