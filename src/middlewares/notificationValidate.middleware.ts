import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import {
  notificationIdParamSchema,
  notificationQuerySchema,
} from '../validators/notification.validator';

function containsMongoOperators(value: unknown, path = 'query'): string | null {
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
        return path === 'query' ? key : `${path}.${key}`;
      }
      const found = containsMongoOperators(nested, path === 'query' ? key : `${path}.${key}`);
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
          path: issue.path.join('.') || 'query',
          message: issue.message,
        })),
      ),
    );
    return null;
  }
  return result.data;
}

export function validateNotificationQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(notificationQuerySchema, req.query, next);
  if (!data) {
    return;
  }
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validateNotificationIdParam(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(notificationIdParamSchema, req.params, next);
  if (!data) {
    return;
  }
  req.params.id = data.id;
  next();
}
