import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import { parseRequestSchema } from '../utils/validation';
import {
  EMPLOYER_CANDIDATE_FORBIDDEN_FIELDS,
  employerCandidateDetailQuerySchema,
  employerCandidateFolderCreateSchema,
  employerCandidateFolderUpdateSchema,
  employerCandidateIdParamSchema,
  employerCandidateListQuerySchema,
  employerCandidateRecontactCreateSchema,
  employerCandidateRecontactQuerySchema,
  employerCandidateSaveBodySchema,
  employerCandidateSavedListQuerySchema,
  employerCandidateSavedSearchCreateSchema,
  employerCandidateTagsBodySchema,
  employerCandidateUpdateSavedBodySchema,
} from '../validators/employerCandidate.validator';

function validateWithSchema<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  next: NextFunction,
  root: 'body' | 'query' | 'params' = 'body',
): T | null {
  return parseRequestSchema(schema, payload, next, root);
}

function rejectForbidden(body: Record<string, unknown>, next: NextFunction): boolean {
  const forbidden = Object.keys(body).filter((key) =>
    (EMPLOYER_CANDIDATE_FORBIDDEN_FIELDS as readonly string[]).includes(key),
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

export function validateEmployerCandidateListQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(employerCandidateListQuerySchema, req.query, next, 'query');
  if (!data) return;
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validateEmployerCandidateDetailQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(employerCandidateDetailQuerySchema, req.query, next, 'query');
  if (!data) return;
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validateEmployerCandidateIdParam(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(employerCandidateIdParamSchema, req.params, next, 'params');
  if (!data) return;
  req.params.id = data.id;
  next();
}

export function validateEmployerCandidateSavedSearchCreate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }
  if (rejectForbidden(req.body as Record<string, unknown>, next)) return;
  const data = validateWithSchema(employerCandidateSavedSearchCreateSchema, req.body, next);
  if (!data) return;
  req.body = data;
  next();
}

export function validateEmployerCandidateFolderCreate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }
  if (rejectForbidden(req.body as Record<string, unknown>, next)) return;
  const data = validateWithSchema(employerCandidateFolderCreateSchema, req.body, next);
  if (!data) return;
  req.body = data;
  next();
}

export function validateEmployerCandidateFolderUpdate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }
  if (rejectForbidden(req.body as Record<string, unknown>, next)) return;
  const data = validateWithSchema(employerCandidateFolderUpdateSchema, req.body, next);
  if (!data) return;
  req.body = data;
  next();
}

export function validateEmployerCandidateSavedListQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(employerCandidateSavedListQuerySchema, req.query, next, 'query');
  if (!data) return;
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validateEmployerCandidateSaveBody(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }
  if (rejectForbidden(req.body as Record<string, unknown>, next)) return;
  const data = validateWithSchema(employerCandidateSaveBodySchema, req.body, next);
  if (!data) return;
  req.body = data;
  next();
}

export function validateEmployerCandidateUpdateSavedBody(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }
  if (rejectForbidden(req.body as Record<string, unknown>, next)) return;
  const data = validateWithSchema(employerCandidateUpdateSavedBodySchema, req.body, next);
  if (!data) return;
  req.body = data;
  next();
}

export function validateEmployerCandidateTagsBody(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }
  if (rejectForbidden(req.body as Record<string, unknown>, next)) return;
  const data = validateWithSchema(employerCandidateTagsBodySchema, req.body, next);
  if (!data) return;
  req.body = data;
  next();
}

export function validateEmployerCandidateRecontactCreate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }
  if (rejectForbidden(req.body as Record<string, unknown>, next)) return;
  const data = validateWithSchema(employerCandidateRecontactCreateSchema, req.body, next);
  if (!data) return;
  req.body = data;
  next();
}

export function validateEmployerCandidateRecontactQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(employerCandidateRecontactQuerySchema, req.query, next, 'query');
  if (!data) return;
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}
