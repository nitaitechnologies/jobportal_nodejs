import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import { containsMongoOperators } from '../utils/validation';
import {
  COMPANY_PROFILE_FORBIDDEN_FIELDS,
  EMPLOYER_PROFILE_FORBIDDEN_FIELDS,
  companyProfileUpdateSchema,
  employerProfileUpdateSchema,
} from '../validators/employerCompany.validator';

function rejectForbiddenFields(
  body: unknown,
  forbidden: readonly string[],
  next: NextFunction,
): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return false;
  }

  const hits = Object.keys(body).filter((key) => forbidden.includes(key));
  if (hits.length > 0) {
    next(
      new AppError(
        'One or more fields cannot be updated through this endpoint',
        HTTP_STATUS.BAD_REQUEST,
        hits.map((path) => ({ path, message: 'This field cannot be updated here' })),
      ),
    );
    return false;
  }

  return true;
}

function rejectMongoOperators(body: unknown, next: NextFunction): boolean {
  const operatorPath = containsMongoOperators(body, 'body');
  if (operatorPath) {
    next(
      new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, [
        { path: operatorPath, message: 'MongoDB operators are not allowed' },
      ]),
    );
    return false;
  }
  return true;
}

export function validateEmployerProfileUpdate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!rejectForbiddenFields(req.body, EMPLOYER_PROFILE_FORBIDDEN_FIELDS, next)) {
    return;
  }
  if (!rejectMongoOperators(req.body, next)) {
    return;
  }

  const result = employerProfileUpdateSchema.safeParse(req.body);
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
    return;
  }

  req.body = result.data;
  next();
}

export function validateCompanyProfileUpdate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!rejectForbiddenFields(req.body, COMPANY_PROFILE_FORBIDDEN_FIELDS, next)) {
    return;
  }
  if (!rejectMongoOperators(req.body, next)) {
    return;
  }

  const result = companyProfileUpdateSchema.safeParse(req.body);
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
    return;
  }

  req.body = result.data;
  next();
}
