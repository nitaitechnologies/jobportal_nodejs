import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { adminAiFeatureService } from '../services/adminAiFeature.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type { AdminAiFeatureUpdateInput } from '../validators/adminAiFeature.validator';

export class AdminAiFeatureController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.admin) throw new AppError('Admin access required', HTTP_STATUS.FORBIDDEN);
      const data = await adminAiFeatureService.list();
      sendSuccess(res, data, 'AI features fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.admin) throw new AppError('Admin access required', HTTP_STATUS.FORBIDDEN);
      const data = await adminAiFeatureService.update(
        req.admin,
        req.body as AdminAiFeatureUpdateInput,
      );
      sendSuccess(res, data, 'AI features updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const adminAiFeatureController = new AdminAiFeatureController();
