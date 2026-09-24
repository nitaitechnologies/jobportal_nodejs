import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { employerAuthService } from '../services/employerAuth.service';
import { authSessionService } from '../services/authSession.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  EmployerLoginInput,
  EmployerOtpSendInput,
  EmployerRegisterInput,
  EmployerVerifyOtpInput,
} from '../validators/employerAuth.validator';
import '../types/express';

function deviceMeta(req: Request) {
  return {
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '',
    ip: req.ip || '',
    deviceLabel: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 80) : 'Web',
  };
}

export class EmployerAuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await employerAuthService.register(
        req.body as EmployerRegisterInput,
        deviceMeta(req),
      );
      sendSuccess(res, result, 'Employer registration successful', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await employerAuthService.login(
        req.body as EmployerLoginInput,
        deviceMeta(req),
      );
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

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
      }
      const result = await employerAuthService.logout(req.auth.userId, req.auth.sessionId);
      sendSuccess(
        res,
        {
          ...result,
          instruction: 'Discard the access token on the client.',
        },
        'Employer logged out successfully',
      );
    } catch (error) {
      next(error);
    }
  }

  async sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
      }
      const body = req.body as EmployerOtpSendInput;
      const result = await employerAuthService.sendVerificationOtp(req.auth.userId, body.channel);
      sendSuccess(res, result, 'OTP sent successfully');
    } catch (error) {
      next(error);
    }
  }

  async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
      }
      const result = await employerAuthService.verifyContact(
        req.auth.userId,
        req.body as EmployerVerifyOtpInput,
      );
      sendSuccess(res, result, 'Verification successful');
    } catch (error) {
      next(error);
    }
  }

  async listSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
      }
      const sessions = await authSessionService.listForUser(req.auth.userId, req.auth.sessionId);
      sendSuccess(res, { sessions }, 'Sessions fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async revokeOtherSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
      }
      const result = await authSessionService.revokeOthers(req.auth.userId, req.auth.sessionId);
      sendSuccess(res, result, 'Other sessions signed out');
    } catch (error) {
      next(error);
    }
  }

  async revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
      }
      const sessionId = typeof req.params.id === 'string' ? req.params.id : '';
      if (req.auth.sessionId && sessionId === req.auth.sessionId) {
        throw new AppError('Use logout to end the current session', HTTP_STATUS.BAD_REQUEST);
      }
      const result = await authSessionService.revoke(sessionId, req.auth.userId);
      if (!result.revoked) {
        throw new AppError('Session not found', HTTP_STATUS.NOT_FOUND);
      }
      sendSuccess(res, result, 'Session signed out');
    } catch (error) {
      next(error);
    }
  }
}

export const employerAuthController = new EmployerAuthController();
