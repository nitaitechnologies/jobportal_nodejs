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

/** When AI resume is disabled / no API key, hide endpoints entirely (404). */
export function requireAiResumeEnabled(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!env.enableAiResume || !env.openaiApiKey) {
    next(new AppError('Not found', HTTP_STATUS.NOT_FOUND));
    return;
  }
  next();
}

/** AI job matching / explain-why (102, 107). */
export function requireAiMatchingEnabled(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!env.enableAiMatching || !env.openaiApiKey) {
    next(new AppError('Not found', HTTP_STATUS.NOT_FOUND));
    return;
  }
  next();
}

/** AI career coach (109–112). */
export function requireAiCareerCoachEnabled(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!env.enableAiCareerCoach || !env.openaiApiKey) {
    next(new AppError('Not found', HTTP_STATUS.NOT_FOUND));
    return;
  }
  next();
}

/** Employer AI Recruitment Assistant + AI Interview (293–303). */
export function requireAiRecruitmentEnabled(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!env.enableAiRecruitment || !env.openaiApiKey) {
    next(new AppError('Not found', HTTP_STATUS.NOT_FOUND));
    return;
  }
  next();
}
