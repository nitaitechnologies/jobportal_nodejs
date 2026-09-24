import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import { parseRequestSchema } from '../utils/validation';
import {
  SAVED_SEARCH_FORBIDDEN_FIELDS,
  alertSettingsUpdateSchema,
  savedSearchCreateSchema,
  savedSearchIdParamSchema,
  savedSearchQuerySchema,
  savedSearchUpdateSchema,
} from '../validators/savedSearch.validator';

function validateWithSchema<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  next: NextFunction,
  root: 'body' | 'query' | 'params' = 'body',
): T | null {
  return parseRequestSchema(schema, payload, next, root);
}

export function validateSavedSearchIdParam(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(savedSearchIdParamSchema, req.params, next, 'params');
  if (!data) return;
  req.params.id = data.id;
  next();
}

export function validateSavedSearchQuery(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(savedSearchQuerySchema, req.query, next, 'query');
  if (!data) return;
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

function rejectForbidden(body: Record<string, unknown>, next: NextFunction): boolean {
  const forbidden = Object.keys(body).filter((key) =>
    (SAVED_SEARCH_FORBIDDEN_FIELDS as readonly string[]).includes(key),
  );
  if (forbidden.length > 0) {
    next(
      new AppError(
        'One or more fields cannot be set through this endpoint',
        HTTP_STATUS.BAD_REQUEST,
        forbidden.map((path) => ({ path, message: 'This field cannot be set here' })),
      ),
    );
    return true;
  }
  return false;
}

export function validateSavedSearchCreate(req: Request, _res: Response, next: NextFunction): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }
  if (rejectForbidden(req.body as Record<string, unknown>, next)) return;
  const data = validateWithSchema(savedSearchCreateSchema, req.body, next);
  if (!data) return;
  req.body = data;
  next();
}

export function validateSavedSearchUpdate(req: Request, _res: Response, next: NextFunction): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }
  if (rejectForbidden(req.body as Record<string, unknown>, next)) return;
  const data = validateWithSchema(savedSearchUpdateSchema, req.body, next);
  if (!data) return;
  req.body = data;
  next();
}

export function validateAlertSettingsUpdate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }
  const data = validateWithSchema(alertSettingsUpdateSchema, req.body, next);
  if (!data) return;
  req.body = data;
  next();
}
