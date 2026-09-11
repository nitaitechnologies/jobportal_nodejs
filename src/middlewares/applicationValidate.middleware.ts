import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import { parseRequestSchema } from '../utils/validation';
import {
  APPLICATION_FORBIDDEN_FIELDS,
  applicationApplySchema,
  applicationIdParamSchema,
  applicationStatusUpdateSchema,
  candidateApplicationQuerySchema,
  employerApplicationQuerySchema,
  jobIdParamSchema,
} from '../validators/application.validator';

function validateWithSchema<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  next: NextFunction,
  root: 'body' | 'query' | 'params' = 'body',
): T | null {
  return parseRequestSchema(schema, payload, next, root);
}

export function validateJobIdParam(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(jobIdParamSchema, req.params, next, 'params');
  if (!data) {
    return;
  }
  req.params.jobId = data.jobId;
  next();
}

export function validateApplicationIdParam(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(applicationIdParamSchema, req.params, next, 'params');
  if (!data) {
    return;
  }
  req.params.id = data.id;
  next();
}

export function validateCandidateApplicationQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(candidateApplicationQuerySchema, req.query, next, 'query');
  if (!data) {
    return;
  }
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validateEmployerApplicationQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(employerApplicationQuerySchema, req.query, next, 'query');
  if (!data) {
    return;
  }
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validateApplicationApply(req: Request, _res: Response, next: NextFunction): void {
  if (req.body === undefined || req.body === null) {
    req.body = {};
  }
  if (typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }

  const forbidden = Object.keys(req.body).filter((key) =>
    (APPLICATION_FORBIDDEN_FIELDS as readonly string[]).includes(key),
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

  const data = validateWithSchema(applicationApplySchema, req.body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}

export function validateApplicationStatusUpdate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }

  const extra = Object.keys(req.body).filter((key) => key !== 'status');
  if (extra.length > 0) {
    next(
      new AppError(
        'Only status can be updated through this endpoint',
        HTTP_STATUS.BAD_REQUEST,
        extra.map((path) => ({ path, message: 'This field cannot be set here' })),
      ),
    );
    return;
  }

  const data = validateWithSchema(applicationStatusUpdateSchema, req.body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}
