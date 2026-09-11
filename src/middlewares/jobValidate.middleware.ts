import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import { parseRequestSchema } from '../utils/validation';
import {
  JOB_FORBIDDEN_FIELDS,
  employerJobQuerySchema,
  jobCreateSchema,
  jobUpdateSchema,
  publicJobQuerySchema,
} from '../validators/job.validator';

function validateWithSchema<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  next: NextFunction,
  root: 'body' | 'query' | 'params' = 'body',
): T | null {
  return parseRequestSchema(schema, payload, next, root);
}

function rejectForbiddenFields(body: Record<string, unknown>, next: NextFunction): boolean {
  const forbidden = Object.keys(body).filter((key) =>
    (JOB_FORBIDDEN_FIELDS as readonly string[]).includes(key),
  );
  if (forbidden.length > 0) {
    next(
      new AppError(
        'One or more fields cannot be set through this endpoint',
        HTTP_STATUS.BAD_REQUEST,
        forbidden.map((path) => ({ path, message: 'This field cannot be set here' })),
      ),
    );
    return false;
  }
  return true;
}

export function validateEmployerJobQuery(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(employerJobQuerySchema, req.query, next, 'query');
  if (!data) {
    return;
  }
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validatePublicJobQuery(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(publicJobQuerySchema, req.query, next, 'query');
  if (!data) {
    return;
  }
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validateJobCreate(req: Request, _res: Response, next: NextFunction): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }
  if (!rejectForbiddenFields(req.body as Record<string, unknown>, next)) {
    return;
  }
  const data = validateWithSchema(jobCreateSchema, req.body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}

export function validateJobUpdate(req: Request, _res: Response, next: NextFunction): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }
  if (!rejectForbiddenFields(req.body as Record<string, unknown>, next)) {
    return;
  }
  const data = validateWithSchema(jobUpdateSchema, req.body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}
