import { z } from 'zod';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

export const chatConversationListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  })
  .strict();

export const chatMessagesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(40),
    before: z.string().datetime().optional(),
  })
  .strict();

export const chatConversationIdParamSchema = z
  .object({
    id: objectIdSchema,
  })
  .strict();

export const chatOpenBodySchema = z
  .object({
    applicationId: objectIdSchema,
  })
  .strict();

export const chatSendBodySchema = z
  .object({
    body: z.string().trim().max(5000).optional().default(''),
    type: z.enum(['text', 'file', 'resume_share', 'interview_note']).optional().default('text'),
    mediaRef: z.string().trim().max(120).optional(),
    fileName: z.string().trim().max(255).optional(),
    mimeType: z.string().trim().max(120).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.type === 'text' || data.type === 'interview_note') {
      if (!data.body?.trim()) {
        ctx.addIssue({ code: 'custom', message: 'Message body is required', path: ['body'] });
      }
    }
    if (data.type === 'file' && !data.mediaRef?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'mediaRef is required for file messages', path: ['mediaRef'] });
    }
  });

export const chatBlockBodySchema = z
  .object({
    userId: objectIdSchema,
    reason: z.string().trim().max(500).optional().default(''),
  })
  .strict();

export const chatUnblockParamSchema = z
  .object({
    userId: objectIdSchema,
  })
  .strict();

export const chatContactQuerySchema = z
  .object({
    applicationId: objectIdSchema,
  })
  .strict();

export type ChatConversationListQuery = z.infer<typeof chatConversationListQuerySchema>;
export type ChatMessagesQuery = z.infer<typeof chatMessagesQuerySchema>;
export type ChatOpenBody = z.infer<typeof chatOpenBodySchema>;
export type ChatSendBody = z.infer<typeof chatSendBodySchema>;
export type ChatBlockBody = z.infer<typeof chatBlockBodySchema>;
