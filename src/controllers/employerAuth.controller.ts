import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { employerAuthService } from '../services/employerAuth.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  EmployerLoginInput,
  EmployerRegisterInput,
} from '../validators/employerAuth.validator';
import '../types/express';

export class EmployerAuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await employerAuthService.register(req.body as EmployerRegisterInput);
      sendSuccess(res, result, 'Employer registration successful', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await employerAuthService.login(req.body as EmployerLoginInput);
      sendSuccess(res, result, 'Employer login successful');
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
      }

      const result = await employerAuthService.getProfile(req.auth.userId);
      sendSuccess(res, result, 'Employer profile fetched successfully');
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
          instruction:
            'Discard the access token on the client. Server-side token revocation is not enabled for this release.',
        },
        'Employer logged out successfully',
      );
    } catch (error) {
      next(error);
    }
  }
}

export const employerAuthController = new EmployerAuthController();
