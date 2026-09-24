import { NextFunction, Request, Response } from 'express';
import {
  companyDocumentSubmitSchema,
  companyVerificationDetailsSchema,
} from '../validators/companyVerification.validator';
import { AppError } from '../utils/AppError';
import { HTTP_STATUS } from '../constants';

export function validateCompanyVerificationDetails(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const result = companyVerificationDetailsSchema.safeParse(req.body);
  if (!result.success) {
    next(
      new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, result.error.issues.map((i) => ({
        path: i.path.join('.') || 'body',
        message: i.message,
      }))),
    );
    return;
  }
  req.body = result.data;
  next();
}

export function validateCompanyDocumentSubmit(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  // Multipart: type may be in body as string field alongside file
  const result = companyDocumentSubmitSchema.safeParse({
    type: typeof req.body?.type === 'string' ? req.body.type : undefined,
  });
  if (!result.success) {
    next(
      new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, result.error.issues.map((i) => ({
        path: i.path.join('.') || 'body',
        message: i.message,
      }))),
    );
    return;
  }
  req.body = { ...req.body, type: result.data.type };
  next();
}
