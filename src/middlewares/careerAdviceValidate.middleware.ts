import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import {
  CAREER_ARTICLE_FORBIDDEN_FIELDS,
  adminCareerAdviceQuerySchema,
  careerArticleCreateSchema,
  careerArticleIdParamSchema,
  careerArticleSlugParamSchema,
  careerArticleUpdateSchema,
  publicCareerAdviceQuerySchema,
} from '../validators/careerAdvice.validator';

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

function rejectForbidden(body: unknown, next: NextFunction): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return false;
  }

  const forbidden = Object.keys(body).filter((key) =>
    (CAREER_ARTICLE_FORBIDDEN_FIELDS as readonly string[]).includes(key),
  );
  if (forbidden.length > 0) {
    next(
      new AppError(
        'One or more fields cannot be set through this endpoint',
        HTTP_STATUS.BAD_REQUEST,
        forbidden.map((path) => ({ path, message: 'This field cannot be set here' })),
      ),
    );
    return false;
  }
  return true;
}

export function validatePublicCareerAdviceQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(publicCareerAdviceQuerySchema, req.query, next, 'query');
  if (!data) {
    return;
  }
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validateAdminCareerAdviceQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(adminCareerAdviceQuerySchema, req.query, next, 'query');
  if (!data) {
    return;
  }
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validateCareerArticleCreate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!rejectForbidden(req.body, next)) {
    return;
  }
  const data = validateWithSchema(careerArticleCreateSchema, req.body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}

export function validateCareerArticleUpdate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!rejectForbidden(req.body, next)) {
    return;
  }
  const data = validateWithSchema(careerArticleUpdateSchema, req.body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}

export function validateCareerArticleIdParam(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(careerArticleIdParamSchema, req.params, next, 'params');
  if (!data) {
    return;
  }
  req.params.id = data.id;
  next();
}

export function validateCareerArticleSlugParam(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(careerArticleSlugParamSchema, req.params, next, 'params');
  if (!data) {
    return;
  }
  req.params.slug = data.slug;
  next();
}
