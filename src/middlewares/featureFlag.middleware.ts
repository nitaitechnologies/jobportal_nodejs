import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { env } from '../config/env';
import type { AiFeatureKey } from '../constants/aiFeatures';
import { AppError } from '../utils/AppError';
import { isAiFeatureEnabled } from '../utils/featureFlags';

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

/** Hide an AI route when admin, env, or missing API key has turned it off. */
export function requireAiFeature(key: AiFeatureKey) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    void isAiFeatureEnabled(key)
      .then((enabled) => {
        if (!enabled) {
          next(new AppError('Not found', HTTP_STATUS.NOT_FOUND));
          return;
        }
        next();
      })
      .catch(next);
  };
}

export const requireAiResumeEnabled = requireAiFeature('aiResumeEnabled');
export const requireAiMatchingEnabled = requireAiFeature('aiMatchingEnabled');
export const requireAiCareerCoachEnabled = requireAiFeature('aiCareerCoachEnabled');
export const requireAiRecruitmentEnabled = requireAiFeature('aiRecruitmentEnabled');
