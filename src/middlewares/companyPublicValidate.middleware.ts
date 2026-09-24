import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import { containsMongoOperators } from '../utils/validation';
import {
  companyJobsQuerySchema,
  companyReviewCreateSchema,
  companyReviewsQuerySchema,
  companyReviewUpdateSchema,
  type CompanyJobsQuery,
  type CompanyReviewsQuery,
} from '../validators/employerCompany.validator';

type RequestWithValidatedQuery = Request & {
  validatedQuery?: CompanyJobsQuery | CompanyReviewsQuery;
};

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

export function validateCompanyJobsQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const result = companyJobsQuerySchema.safeParse(req.query);
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
    return;
  }
  (req as RequestWithValidatedQuery).validatedQuery = result.data;
  next();
}

export function validateCompanyReviewsQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const result = companyReviewsQuerySchema.safeParse(req.query);
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
    return;
  }
  (req as RequestWithValidatedQuery).validatedQuery = result.data;
  next();
}

export function validateCompanyReviewCreate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!rejectMongoOperators(req.body, next)) return;
  const result = companyReviewCreateSchema.safeParse(req.body);
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

export function validateCompanyReviewUpdate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!rejectMongoOperators(req.body, next)) return;
  const result = companyReviewUpdateSchema.safeParse(req.body);
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
