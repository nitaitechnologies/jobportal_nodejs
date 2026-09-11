import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import {
  SETTING_CREATE_FORBIDDEN,
  SETTING_UPDATE_FORBIDDEN,
  adminSettingCreateSchema,
  adminSettingKeyParamSchema,
  adminSettingListQuerySchema,
  adminSettingStatusSchema,
  adminSettingUpdateSchema,
} from '../validators/settings.validator';

function containsMongoOperators(value: unknown, path = 'body'): string | null {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const found = containsMongoOperators(value[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith('$')) {
        return path === 'body' || path === 'query' || path === 'params' ? key : `${path}.${key}`;
      }
      const found = containsMongoOperators(
        nested,
        path === 'body' || path === 'query' || path === 'params' ? key : `${path}.${key}`,
      );
      if (found) return found;
    }
  }
  return null;
}

function validateWithSchema<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  next: NextFunction,
  root: 'body' | 'query' | 'params',
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

function rejectForbidden(body: unknown, forbidden: readonly string[], next: NextFunction): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return false;
  }
  for (const key of Object.keys(body as object)) {
    if (forbidden.includes(key)) {
      next(
        new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, [
          { path: key, message: 'Field is not allowed' },
        ]),
      );
      return false;
    }
  }
  return true;
}

export function validateAdminSettingListQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(adminSettingListQuerySchema, req.query, next, 'query');
  if (data) {
    (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
    next();
  }
}

export function validateAdminSettingKeyParam(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(adminSettingKeyParamSchema, req.params, next, 'params');
  if (data) next();
}

export function validateAdminSettingCreate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!rejectForbidden(req.body, SETTING_CREATE_FORBIDDEN, next)) return;
  const data = validateWithSchema(adminSettingCreateSchema, req.body, next, 'body');
  if (data) {
    req.body = data;
    next();
  }
}

export function validateAdminSettingUpdate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!rejectForbidden(req.body, SETTING_UPDATE_FORBIDDEN, next)) return;
  const data = validateWithSchema(adminSettingUpdateSchema, req.body, next, 'body');
  if (data) {
    req.body = data;
    next();
  }
}

export function validateAdminSettingStatus(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(adminSettingStatusSchema, req.body, next, 'body');
  if (data) {
    req.body = data;
    next();
  }
}
