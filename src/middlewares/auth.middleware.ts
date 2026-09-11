import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import { verifyAccessToken } from '../utils/jwt';
import '../types/express';

/**
 * Authentication: verify Bearer JWT and attach req.auth.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
    }

    const token = header.slice('Bearer '.length).trim();

    if (!token) {
      throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
    }

    const payload = verifyAccessToken(token);

    req.auth = {
      userId: payload.userId,
      role: payload.role,
      ...(payload.adminUserId ? { adminUserId: payload.adminUserId } : {}),
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Access token has expired', HTTP_STATUS.UNAUTHORIZED));
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid access token', HTTP_STATUS.UNAUTHORIZED));
      return;
    }

    next(new AppError('Authentication failed', HTTP_STATUS.UNAUTHORIZED));
  }
}
