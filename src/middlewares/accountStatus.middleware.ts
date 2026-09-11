import { NextFunction, Request, Response } from 'express';
import { User } from '../models/User';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import '../types/express';

/**
 * Enforce live User.status after JWT auth for shared candidate/employer routes.
 * Prefer requireCandidate / requireEmployer when role-specific context is needed.
 */
export async function requireActiveAccount(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.auth) {
      throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
    }

    const user = await User.findById(req.auth.userId).select('role status deletedAt');
    if (
      !user ||
      user.deletedAt ||
      user.status !== 'active' ||
      user.role !== req.auth.role
    ) {
      throw new AppError('Account access denied', HTTP_STATUS.FORBIDDEN);
    }

    next();
  } catch (error) {
    next(error);
  }
}
