import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { employerProfileService } from '../services/employerProfile.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type { EmployerProfileUpdateInput } from '../validators/employerCompany.validator';
import '../types/express';

export class EmployerProfileController {
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
      }

      const data = await employerProfileService.getOwnProfile(req.auth.userId);
      sendSuccess(res, data, 'Employer profile fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
      }

      const data = await employerProfileService.updateOwnProfile(
        req.auth.userId,
        req.body as EmployerProfileUpdateInput,
      );
      sendSuccess(res, data, 'Employer profile updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const employerProfileController = new EmployerProfileController();
