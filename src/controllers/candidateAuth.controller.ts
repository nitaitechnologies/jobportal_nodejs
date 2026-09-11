import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { candidateAuthService } from '../services/candidateAuth.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  CandidateLoginInput,
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
