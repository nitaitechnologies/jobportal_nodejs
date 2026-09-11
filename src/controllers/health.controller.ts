import { NextFunction, Request, Response } from 'express';
import { healthService } from '../services/health.service';
import { sendSuccess } from '../utils/apiResponse';

export class HealthController {
  getHealth(_req: Request, res: Response, next: NextFunction): void {
    try {
      const data = healthService.getStatus();
      sendSuccess(res, data, 'API is running');
    } catch (error) {
      next(error);
    }
  }
}

export const healthController = new HealthController();
