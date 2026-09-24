import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { parseRequestSchema } from '../utils/validation';
import {
  chatBlockBodySchema,
  chatContactQuerySchema,
  chatConversationIdParamSchema,
  chatConversationListQuerySchema,
  chatMessagesQuerySchema,
  chatOpenBodySchema,
  chatSendBodySchema,
  chatUnblockParamSchema,
} from '../validators/chat.validator';

function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = parseRequestSchema(schema, req.body, next, 'body');
    if (!data) return;
    req.body = data;
    next();
  };
}

function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = parseRequestSchema(schema, req.query, next, 'query');
    if (!data) return;
    (req as Request & { validatedQuery?: T }).validatedQuery = data;
    next();
  };
}

function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = parseRequestSchema(schema, req.params, next, 'params');
    if (!data) return;
    req.params = data as unknown as typeof req.params;
    next();
  };
}

export const validateChatListQuery = validateQuery(chatConversationListQuerySchema);
export const validateChatMessagesQuery = validateQuery(chatMessagesQuerySchema);
export const validateChatConversationId = validateParams(chatConversationIdParamSchema);
export const validateChatOpenBody = validateBody(chatOpenBodySchema);
export const validateChatSendBody = validateBody(chatSendBodySchema);
export const validateChatBlockBody = validateBody(chatBlockBodySchema);
export const validateChatUnblockParam = validateParams(chatUnblockParamSchema);
export const validateChatContactQuery = validateQuery(chatContactQuerySchema);
