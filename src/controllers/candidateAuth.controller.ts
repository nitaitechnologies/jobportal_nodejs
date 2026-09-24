import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { candidateAuthService } from '../services/candidateAuth.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  CandidateAccountDeleteInput,
  CandidateLoginInput,
  CandidateOtpSendInput,
  CandidateOtpVerifyInput,
  CandidatePasswordForgotInput,
  CandidatePasswordResetInput,
  CandidateRegisterInput,
} from '../validators/candidateAuth.validator';
import '../types/express';

export class CandidateAuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await candidateAuthService.register(req.body as CandidateRegisterInput);
      sendSuccess(res, result, 'Candidate registration successful', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await candidateAuthService.login(req.body as CandidateLoginInput);
      sendSuccess(res, result, 'Candidate login successful');
    } catch (error) {
      next(error);
    }
  }

  async sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await candidateAuthService.sendOtp(req.body as CandidateOtpSendInput);
      sendSuccess(res, result, 'OTP sent successfully');
    } catch (error) {
      next(error);
    }
  }

  async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await candidateAuthService.verifyOtp(req.body as CandidateOtpVerifyInput);
      const status = result.isNewUser ? HTTP_STATUS.CREATED : HTTP_STATUS.OK;
      const message = result.isNewUser
        ? 'Candidate registration successful'
        : 'Candidate login successful';
      sendSuccess(res, result, message, status);
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await candidateAuthService.forgotPassword(
        req.body as CandidatePasswordForgotInput,
      );
      sendSuccess(res, result, 'If an account exists, a reset code has been issued');
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await candidateAuthService.resetPassword(
        req.body as CandidatePasswordResetInput,
      );
      sendSuccess(res, result, 'Password reset successful');
    } catch (error) {
      next(error);
    }
  }

  async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
      }
      const result = await candidateAuthService.deactivateAccount(req.auth.userId);
      sendSuccess(res, result, 'Candidate account deactivated');
    } catch (error) {
      next(error);
    }
  }

  async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
      }
      const result = await candidateAuthService.deleteAccount(
        req.auth.userId,
        req.body as CandidateAccountDeleteInput,
      );
      sendSuccess(res, result, 'Candidate account deleted');
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
      }

      const result = await candidateAuthService.getProfile(req.auth.userId);
      sendSuccess(res, result, 'Candidate profile fetched successfully');
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
        'Candidate logged out successfully',
      );
    } catch (error) {
      next(error);
    }
  }
}

export const candidateAuthController = new CandidateAuthController();
