import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { parseRequestSchema } from '../utils/validation';
import {
  savedJobIdParamSchema,
  savedJobListQuerySchema,
} from '../validators/savedJob.validator';

function validateWithSchema<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  next: NextFunction,
  root: 'body' | 'query' | 'params' = 'body',
): T | null {
  return parseRequestSchema(schema, payload, next, root);
}

export function validateSavedJobIdParam(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(savedJobIdParamSchema, req.params, next, 'params');
  if (!data) {
    return;
  }
  req.params.jobId = data.jobId;
  next();
}

export function validateSavedJobListQuery(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(savedJobListQuerySchema, req.query, next, 'query');
  if (!data) {
    return;
  }
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}
