import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import {
  INTERVIEW_FORBIDDEN_FIELDS,
  candidateInterviewQuerySchema,
  employerInterviewQuerySchema,
  interviewCancelSchema,
  interviewCreateSchema,
  interviewDeclineSchema,
  interviewIdParamSchema,
  interviewRescheduleSchema,
  interviewUpdateSchema,
} from '../validators/interview.validator';

function containsMongoOperators(value: unknown, path = 'body'): string | null {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const found = containsMongoOperators(value[i], `${path}[${i}]`);
      if (found) {
        return found;
      }
    }
    return null;
  }

  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith('$')) {
        return path === 'body' ? key : `${path}.${key}`;
      }
      const found = containsMongoOperators(nested, path === 'body' ? key : `${path}.${key}`);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

function validateWithSchema<T>(schema: ZodSchema<T>, payload: unknown, next: NextFunction): T | null {
  const operatorPath = containsMongoOperators(payload);
  if (operatorPath) {
    next(
      new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, [
        { path: operatorPath, message: 'MongoDB operators are not allowed' },
      ]),
    );
    return null;
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    next(
      new AppError(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        result.error.issues.map((issue) => ({
          path: issue.path.join('.') || 'body',
          message: issue.message,
        })),
      ),
    );
    return null;
  }
  return result.data;
}

function rejectForbiddenFields(body: unknown, next: NextFunction): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return false;
  }

  const forbidden = Object.keys(body).filter((key) =>
    (INTERVIEW_FORBIDDEN_FIELDS as readonly string[]).includes(key),
  );

  if (forbidden.length > 0) {
    next(
      new AppError(
        'One or more fields cannot be updated through this endpoint',
        HTTP_STATUS.BAD_REQUEST,
        forbidden.map((path) => ({ path, message: 'This field cannot be set here' })),
      ),
    );
    return false;
  }

  return true;
}

export function validateInterviewIdParam(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(interviewIdParamSchema, req.params, next);
  if (!data) {
    return;
  }
  req.params.id = data.id;
  next();
}

export function validateEmployerInterviewQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(employerInterviewQuerySchema, req.query, next);
  if (!data) {
    return;
  }
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validateCandidateInterviewQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(candidateInterviewQuerySchema, req.query, next);
  if (!data) {
    return;
  }
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validateInterviewCreate(req: Request, _res: Response, next: NextFunction): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }

  const body = { ...(req.body as Record<string, unknown>) };
  const blocked = [
    'candidateId',
    'employerId',
    'companyId',
    'jobId',
    'status',
    'createdAt',
    'updatedAt',
    '_id',
    'id',
    'cancellationReason',
  ];
  const injected = Object.keys(body).filter((key) => blocked.includes(key));
  if (injected.length > 0) {
    next(
      new AppError(
        'One or more fields cannot be set through this endpoint',
        HTTP_STATUS.BAD_REQUEST,
        injected.map((path) => ({ path, message: 'This field cannot be set here' })),
      ),
    );
    return;
  }

  const data = validateWithSchema(interviewCreateSchema, body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}

export function validateInterviewUpdate(req: Request, _res: Response, next: NextFunction): void {
  if (!rejectForbiddenFields(req.body, next)) {
    return;
  }
  // applicationId also forbidden on update
  if (req.body && typeof req.body === 'object' && 'applicationId' in req.body) {
    next(
      new AppError(
        'One or more fields cannot be updated through this endpoint',
        HTTP_STATUS.BAD_REQUEST,
        [{ path: 'applicationId', message: 'This field cannot be set here' }],
      ),
    );
    return;
  }

  const data = validateWithSchema(interviewUpdateSchema, req.body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}

export function validateInterviewReschedule(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!rejectForbiddenFields(req.body, next)) {
    return;
  }
  const data = validateWithSchema(interviewRescheduleSchema, req.body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}

export function validateInterviewCancel(req: Request, _res: Response, next: NextFunction): void {
  if (req.body === undefined || req.body === null) {
    req.body = {};
  }
  const data = validateWithSchema(interviewCancelSchema, req.body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}

export function validateInterviewDecline(req: Request, _res: Response, next: NextFunction): void {
  if (req.body === undefined || req.body === null) {
    req.body = {};
  }
  const data = validateWithSchema(interviewDeclineSchema, req.body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}
