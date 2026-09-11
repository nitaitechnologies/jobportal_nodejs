import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import {
  candidateProfileUpdateSchema,
  certificationCreateSchema,
  certificationUpdateSchema,
  educationCreateSchema,
  educationUpdateSchema,
  experienceCreateSchema,
  experienceUpdateSchema,
  skillCreateSchema,
} from '../validators/candidateProfile.validator';

const FORBIDDEN_PROFILE_FIELDS = [
  'email',
  'role',
  'password',
  'passwordHash',
  'status',
  'profileCompletion',
  'userId',
  'candidateId',
  '_id',
  'id',
  'emailVerified',
  'phoneVerified',
  'lastLoginAt',
  'deletedAt',
  'createdAt',
  'updatedAt',
] as const;

const objectIdParam = /^[a-fA-F0-9]{24}$/;

/** Reject MongoDB operator keys (e.g. `$gt`) in nested objects. */
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

/**
 * Validate PATCH body and reject security-sensitive / ownership fields.
 */
export function validateCandidateProfileUpdate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }

  const forbidden = Object.keys(body).filter((key) =>
    (FORBIDDEN_PROFILE_FIELDS as readonly string[]).includes(key),
  );

  if (forbidden.length > 0) {
    next(
      new AppError(
        'One or more fields cannot be updated through this endpoint',
        HTTP_STATUS.BAD_REQUEST,
        forbidden.map((path) => ({ path, message: 'This field cannot be updated here' })),
      ),
    );
    return;
  }

  const data = validateWithSchema(candidateProfileUpdateSchema, body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}

export function validateSkillCreate(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(skillCreateSchema, req.body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}

export function validateEducationCreate(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(educationCreateSchema, req.body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}

export function validateEducationUpdate(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(educationUpdateSchema, req.body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}

export function validateExperienceCreate(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(experienceCreateSchema, req.body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}

export function validateExperienceUpdate(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(experienceUpdateSchema, req.body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}

export function validateCertificationCreate(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(certificationCreateSchema, req.body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}

export function validateCertificationUpdate(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(certificationUpdateSchema, req.body, next);
  if (!data) {
    return;
  }
  req.body = data;
  next();
}

export function validateObjectIdParam(paramName: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    if (typeof value !== 'string' || !objectIdParam.test(value)) {
      next(
        new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, [
          { path: paramName, message: 'Invalid id format' },
        ]),
      );
      return;
    }
    next();
  };
}
