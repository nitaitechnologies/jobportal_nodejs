import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import {
  adminAnalyticsEventsQuerySchema,
  adminAnalyticsOverviewQuerySchema,
  adminAnalyticsPagedQuerySchema,
} from '../validators/analytics.validator';

function containsMongoOperators(value: unknown, path = 'query'): string | null {
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
        return path === 'query' ? key : `${path}.${key}`;
      }
      const found = containsMongoOperators(nested, path === 'query' ? key : `${path}.${key}`);
      if (found) return found;
    }
  }

  return null;
}

function validateQuery<T>(schema: ZodSchema<T>, req: Request, next: NextFunction): boolean {
  const operatorPath = containsMongoOperators(req.query);
  if (operatorPath) {
    next(
      new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, [
        { path: operatorPath, message: 'MongoDB operators are not allowed' },
      ]),
    );
    return false;
  }

  const result = schema.safeParse(req.query);
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
    return false;
  }

  (req as Request & { validatedQuery?: T }).validatedQuery = result.data;
  return true;
}

export function validateAdminAnalyticsOverview(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (validateQuery(adminAnalyticsOverviewQuerySchema, req, next)) next();
}

export function validateAdminAnalyticsEvents(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (validateQuery(adminAnalyticsEventsQuerySchema, req, next)) next();
}

export function validateAdminAnalyticsPaged(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (validateQuery(adminAnalyticsPagedQuerySchema, req, next)) next();
}
