import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import { verifyAccessToken } from '../utils/jwt';
import { authSessionService } from '../services/authSession.service';
import '../types/express';

/**
 * Authentication: verify Bearer JWT and attach req.auth.
 * When `jti` is present, the auth session must still be active (sheet 163–164).
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
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

    if (payload.jti) {
      await authSessionService.assertActive(payload.jti, payload.userId);
    }

    req.auth = {
      userId: payload.userId,
      role: payload.role,
      ...(payload.adminUserId ? { adminUserId: payload.adminUserId } : {}),
      ...(payload.jti ? { sessionId: payload.jti } : {}),
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

/**
 * Optional auth: attach req.auth when a valid Bearer token is present; otherwise continue.
 */
export async function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      next();
      return;
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      next();
      return;
    }
    const payload = verifyAccessToken(token);
    if (payload.jti) {
      await authSessionService.assertActive(payload.jti, payload.userId);
    }
    req.auth = {
      userId: payload.userId,
      role: payload.role,
      ...(payload.adminUserId ? { adminUserId: payload.adminUserId } : {}),
      ...(payload.jti ? { sessionId: payload.jti } : {}),
    };
    next();
  } catch {
    // Invalid token → treat as guest for public support form.
    next();
  }
}
