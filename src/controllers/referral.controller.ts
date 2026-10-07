import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { referralService } from '../services/referral.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type { AdminReferralPointsInput } from '../validators/referral.validator';

function requireAdmin(req: Request) {
  if (!req.admin) throw new AppError('Admin access required', HTTP_STATUS.FORBIDDEN);
  return req.admin;
}

export class ReferralController {
  async candidateMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.candidate) throw new AppError('Candidate access required', HTTP_STATUS.FORBIDDEN);
      const data = await referralService.getMine(req.candidate.userId, 'candidate');
      sendSuccess(res, data, 'Referral wallet fetched');
    } catch (error) {
      next(error);
    }
  }

  async employerMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.employer) throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
      const data = await referralService.getMine(req.employer.userId, 'employer');
      sendSuccess(res, data, 'Referral wallet fetched');
    } catch (error) {
      next(error);
    }
  }

  async adminOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireAdmin(req);
      sendSuccess(res, await referralService.adminOverview(), 'Referrals fetched');
    } catch (error) {
      next(error);
    }
  }

  async adminSetPoints(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = requireAdmin(req);
      const body = req.body as AdminReferralPointsInput;
      const data = await referralService.setPointsPerSignup(admin, body.pointsPerSignup);
      sendSuccess(res, data, 'Referral points updated');
    } catch (error) {
      next(error);
    }
  }
}

export const referralController = new ReferralController();
