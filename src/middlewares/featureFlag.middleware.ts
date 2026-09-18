import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

/** When video resume is disabled, hide endpoints entirely (404). */
export function requireVideoResumeEnabled(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!env.enableVideoResume) {
    next(new AppError('Not found', HTTP_STATUS.NOT_FOUND));
    return;
  }
  next();
}

/** When video JD is disabled, hide endpoints entirely (404). */
export function requireVideoJdEnabled(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!env.enableVideoJd) {
    next(new AppError('Not found', HTTP_STATUS.NOT_FOUND));
    return;
  }
  next();
}
