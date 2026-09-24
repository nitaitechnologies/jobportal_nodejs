import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import { containsMongoOperators } from '../utils/validation';
import {
  blockEmployerSchema,
  candidateDocumentSubmitSchema,
} from '../validators/candidateSafety.validator';

function rejectMongo(body: unknown, next: NextFunction): boolean {
  const path = containsMongoOperators(body, 'body');
  if (path) {
    next(
      new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, [
        { path, message: 'MongoDB operators are not allowed' },
      ]),
    );
    return false;
  }
  return true;
}

export function validateBlockEmployer(req: Request, _res: Response, next: NextFunction): void {
  if (!rejectMongo(req.body, next)) return;
  const result = blockEmployerSchema.safeParse(req.body);
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

export function validateCandidateDocumentSubmit(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!rejectMongo(req.body, next)) return;
  const result = candidateDocumentSubmitSchema.safeParse(req.body);
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
