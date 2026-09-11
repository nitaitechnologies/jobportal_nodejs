import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import type { UserRole } from '../constants/enums';
import { AppError } from '../utils/AppError';
import '../types/express';

/**
 * Authorization: require one of the given User.role values.
 * Must run after authenticate().
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.auth) {
        throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
      }

      if (!roles.includes(req.auth.role)) {
        throw new AppError('Access denied for this role', HTTP_STATUS.FORBIDDEN);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
