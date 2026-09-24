import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import {
  supportTicketCreateSchema,
  supportTicketIdParamSchema,
  supportTicketQuerySchema,
  supportTicketUpdateSchema,
} from '../validators/supportTicket.validator';

function validateWithSchema<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  next: NextFunction,
  root = 'body',
): T | null {
  const result = schema.safeParse(payload);
  if (!result.success) {
    next(
      new AppError(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        result.error.issues.map((issue) => ({
          path: issue.path.join('.') || root,
          message: issue.message,
        })),
      ),
    );
    return null;
  }
  return result.data;
}

export function validateSupportTicketCreate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }
  const data = validateWithSchema(supportTicketCreateSchema, req.body, next);
  if (!data) return;
  req.body = data;
  next();
}

export function validateSupportTicketQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(supportTicketQuerySchema, req.query, next, 'query');
  if (!data) return;
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validateSupportTicketUpdate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }
  const data = validateWithSchema(supportTicketUpdateSchema, req.body, next);
  if (!data) return;
  req.body = data;
  next();
}

export function validateSupportTicketIdParam(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(supportTicketIdParamSchema, req.params, next, 'params');
  if (!data) return;
  next();
}
