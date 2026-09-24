import { z } from 'zod';
import { SUPPORT_TICKET_CATEGORIES, SUPPORT_TICKET_STATUSES } from '../constants/enums';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

export const supportTicketCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200),
    subject: z.string().trim().min(3).max(200),
    category: z.enum(SUPPORT_TICKET_CATEGORIES),
    message: z.string().trim().min(10).max(5000),
  })
  .strict();

export const supportTicketQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(SUPPORT_TICKET_STATUSES).optional(),
    category: z.enum(SUPPORT_TICKET_CATEGORIES).optional(),
    q: z.string().trim().max(120).optional(),
    assignedTo: objectIdSchema.optional(),
  })
  .strict();

export const supportTicketUpdateSchema = z
  .object({
    status: z.enum(SUPPORT_TICKET_STATUSES).optional(),
    assignedTo: objectIdSchema.nullable().optional(),
    resolution: z.string().trim().max(5000).optional(),
    category: z.enum(SUPPORT_TICKET_CATEGORIES).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'At least one field is required' });
    }
  });

export const supportTicketIdParamSchema = z.object({ id: objectIdSchema });

export type SupportTicketCreateInput = z.infer<typeof supportTicketCreateSchema>;
export type SupportTicketQuery = z.infer<typeof supportTicketQuerySchema>;
export type SupportTicketUpdateInput = z.infer<typeof supportTicketUpdateSchema>;
