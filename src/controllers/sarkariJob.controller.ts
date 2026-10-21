import { NextFunction, Request, Response } from 'express';
import { sarkariJobService } from '../services/sarkariJob.service';
import { sendSuccess } from '../utils/apiResponse';

type ValidatedQuery = {
  page: number;
  limit: number;
  q?: string;
  sort?: 'latest' | 'closingSoon';
};

export class SarkariJobController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as Request & { validatedQuery?: ValidatedQuery }).validatedQuery ?? {
        page: 1,
        limit: 20,
        sort: 'latest' as const,
      };
      const data = await sarkariJobService.listPublic(query);
      sendSuccess(res, data, 'Sarkari jobs fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = typeof req.params.slug === 'string' ? req.params.slug : '';
      const data = await sarkariJobService.getPublicBySlug(slug);
      sendSuccess(res, data, 'Sarkari job fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async sync(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await sarkariJobService.syncFromSource();
      sendSuccess(res, data, 'Sarkari jobs synced successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const sarkariJobController = new SarkariJobController();
