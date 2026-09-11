import { NextFunction, Request, Response } from 'express';
import { adminAuthService } from '../services/adminAuth.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { HTTP_STATUS } from '../constants';
import type { AdminLoginInput } from '../validators/adminAuth.validator';
import '../types/express';

export class AdminAuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adminAuthService.login(req.body as AdminLoginInput);
      sendSuccess(res, result, 'Admin login successful');
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth?.adminUserId) {
        throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
      }

      const result = await adminAuthService.getProfile(req.auth.adminUserId, req.auth.userId);
      sendSuccess(res, result, 'Admin profile fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(
        res,
        {
          revoked: false,
          instruction: 'Discard the access token on the client. Server-side token revocation is not enabled for this release.',
        },
        'Admin logged out successfully',
      );
    } catch (error) {
      next(error);
    }
  }
}

export const adminAuthController = new AdminAuthController();
