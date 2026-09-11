import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import { parseRequestSchema } from '../utils/validation';
import {
  CATEGORY_FORBIDDEN_FIELDS,
  CATEGORY_UPDATE_FORBIDDEN_FIELDS,
  adminCategoryQuerySchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  publicCategoryQuerySchema,
} from '../validators/category.validator';

function validateWithSchema<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  next: NextFunction,
  root: 'body' | 'query' | 'params' = 'body',
): T | null {
  return parseRequestSchema(schema, payload, next, root);
}

export function validatePublicCategoryQuery(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(publicCategoryQuerySchema, req.query, next, 'query');
  if (!data) {
    return;
  }
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validateAdminCategoryQuery(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(adminCategoryQuerySchema, req.query, next, 'query');
  if (!data) {
    return;
  }
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validateCategoryCreate(req: Request, _res: Response, next: NextFunction): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }

  const forbidden = Object.keys(req.body).filter((key) =>
    (CATEGORY_FORBIDDEN_FIELDS as readonly string[]).includes(key),
  );
  if (forbidden.length > 0) {
    next(
      new AppError(
        'One or more fields cannot be set through this endpoint',
        HTTP_STATUS.BAD_REQUEST,
        forbidden.map((path) => ({ path, message: 'This field cannot be set here' })),
      ),
    );
    return;
  }

  const data = validateWithSchema(categoryCreateSchema, req.body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}

export function validateCategoryUpdate(req: Request, _res: Response, next: NextFunction): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }

  const forbidden = Object.keys(req.body).filter((key) =>
    (CATEGORY_UPDATE_FORBIDDEN_FIELDS as readonly string[]).includes(key),
  );
  if (forbidden.length > 0) {
    next(
      new AppError(
        'One or more fields cannot be updated through this endpoint',
        HTTP_STATUS.BAD_REQUEST,
        forbidden.map((path) => ({ path, message: 'This field cannot be updated here' })),
      ),
    );
    return;
  }

  const data = validateWithSchema(categoryUpdateSchema, req.body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}
