import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import {
  REPORT_ADMIN_FORBIDDEN_FIELDS,
  REPORT_CREATE_FORBIDDEN_FIELDS,
  adminReportQuerySchema,
  reportAdminUpdateSchema,
  reportCreateSchema,
  reportIdParamSchema,
  userReportQuerySchema,
} from '../validators/report.validator';

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

function validateWithSchema<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  next: NextFunction,
  root = 'body',
): T | null {
  const operatorPath = containsMongoOperators(payload, root);
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
          path: issue.path.join('.') || root,
          message: issue.message,
        })),
      ),
    );
    return null;
  }
  return result.data;
}

function rejectForbidden(
  body: unknown,
  forbidden: readonly string[],
  next: NextFunction,
): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return false;
  }

  const found = Object.keys(body).filter((key) => forbidden.includes(key));
  if (found.length > 0) {
    next(
      new AppError(
        'One or more fields cannot be set through this endpoint',
        HTTP_STATUS.BAD_REQUEST,
        found.map((path) => ({ path, message: 'This field cannot be set here' })),
      ),
    );
    return false;
  }
  return true;
}

export function validateReportCreate(req: Request, _res: Response, next: NextFunction): void {
  if (!rejectForbidden(req.body, REPORT_CREATE_FORBIDDEN_FIELDS, next)) {
    return;
  }
  const data = validateWithSchema(reportCreateSchema, req.body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}

export function validateReportAdminUpdate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!rejectForbidden(req.body, REPORT_ADMIN_FORBIDDEN_FIELDS, next)) {
    return;
  }
  const data = validateWithSchema(reportAdminUpdateSchema, req.body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}

export function validateUserReportQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(userReportQuerySchema, req.query, next, 'query');
  if (!data) {
    return;
  }
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validateAdminReportQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(adminReportQuerySchema, req.query, next, 'query');
  if (!data) {
    return;
  }
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validateReportIdParam(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(reportIdParamSchema, req.params, next, 'params');
  if (!data) {
    return;
  }
  req.params.id = data.id;
  next();
}
