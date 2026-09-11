import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import {
  PLAN_FORBIDDEN_FIELDS,
  SUBSCRIPTION_ADMIN_FORBIDDEN_FIELDS,
  adminPlanQuerySchema,
  adminSubscriptionCreateSchema,
  employerSubscriptionQuerySchema,
  planIdParamSchema,
  planSlugParamSchema,
  publicPlanQuerySchema,
  subscriptionIdParamSchema,
  subscriptionPlanCreateSchema,
  subscriptionPlanUpdateSchema,
} from '../validators/subscription.validator';

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
        return path === 'body' ? key : `${path}.${key}`;
      }
      const found = containsMongoOperators(nested, path === 'body' ? key : `${path}.${key}`);
      if (found) return found;
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

export function validatePublicPlanQuery(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(publicPlanQuerySchema, req.query, next, 'query');
  if (!data) return;
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validateAdminPlanQuery(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(adminPlanQuerySchema, req.query, next, 'query');
  if (!data) return;
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validatePlanCreate(req: Request, _res: Response, next: NextFunction): void {
  if (!rejectForbidden(req.body, PLAN_FORBIDDEN_FIELDS, next)) return;
  const data = validateWithSchema(subscriptionPlanCreateSchema, req.body, next);
  if (!data) return;
  req.body = data;
  next();
}

export function validatePlanUpdate(req: Request, _res: Response, next: NextFunction): void {
  if (!rejectForbidden(req.body, [...PLAN_FORBIDDEN_FIELDS, 'slug'], next)) return;
  const data = validateWithSchema(subscriptionPlanUpdateSchema, req.body, next);
  if (!data) return;
  req.body = data;
  next();
}

export function validatePlanIdParam(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(planIdParamSchema, req.params, next, 'params');
  if (!data) return;
  req.params.id = data.id;
  next();
}

export function validatePlanSlugParam(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(planSlugParamSchema, req.params, next, 'params');
  if (!data) return;
  req.params.slug = data.slug;
  next();
}

export function validateAdminSubscriptionCreate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!rejectForbidden(req.body, SUBSCRIPTION_ADMIN_FORBIDDEN_FIELDS, next)) return;
  const data = validateWithSchema(adminSubscriptionCreateSchema, req.body, next);
  if (!data) return;
  req.body = data;
  next();
}

export function validateEmployerSubscriptionQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(employerSubscriptionQuerySchema, req.query, next, 'query');
  if (!data) return;
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validateSubscriptionIdParam(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(subscriptionIdParamSchema, req.params, next, 'params');
  if (!data) return;
  req.params.id = data.id;
  next();
}
