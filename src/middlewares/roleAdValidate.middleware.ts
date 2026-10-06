import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import {
  roleAdClickQuerySchema,
  roleAdCreateSchema,
  roleAdIdParamSchema,
  roleAdQuerySchema,
  roleAdSuggestQuerySchema,
  roleAdUpdateSchema,
} from '../validators/roleAd.validator';

function validateWithSchema<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  next: NextFunction,
  root: 'body' | 'query' | 'params',
): T | null {
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

function makeQueryValidator(schema: ZodSchema<unknown>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = validateWithSchema(schema, req.query, next, 'query');
    if (data) {
      (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
      next();
    }
  };
}

function makeBodyValidator(schema: ZodSchema<unknown>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = validateWithSchema(schema, req.body, next, 'body');
    if (data) {
      req.body = data;
      next();
    }
  };
}

function makeParamValidator(schema: ZodSchema<{ id: string }>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = validateWithSchema(schema, req.params, next, 'params');
    if (data) {
      req.params.id = data.id;
      next();
    }
  };
}

export const validateRoleAdQuery = makeQueryValidator(roleAdQuerySchema);
export const validateRoleAdCreate = makeBodyValidator(roleAdCreateSchema);
export const validateRoleAdUpdate = makeBodyValidator(roleAdUpdateSchema);
export const validateRoleAdIdParam = makeParamValidator(roleAdIdParamSchema);
export const validateRoleAdClickQuery = makeQueryValidator(roleAdClickQuerySchema);
export const validateRoleAdSuggestQuery = makeQueryValidator(roleAdSuggestQuerySchema);
