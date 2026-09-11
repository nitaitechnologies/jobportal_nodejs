import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { careerAdviceService } from '../services/careerAdvice.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  AdminCareerAdviceQuery,
  CareerArticleCreateInput,
  CareerArticleUpdateInput,
  PublicCareerAdviceQuery,
} from '../validators/careerAdvice.validator';

type RequestWithValidatedQuery = Request & {
  validatedQuery?: PublicCareerAdviceQuery | AdminCareerAdviceQuery;
};

function requireAdmin(req: Request) {
  if (!req.admin) {
    throw new AppError('Admin access required', HTTP_STATUS.FORBIDDEN);
  }
  return req.admin;
}

export class CareerAdviceController {
  async listPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as PublicCareerAdviceQuery;
      const data = await careerAdviceService.listPublic(query);
      sendSuccess(res, data, 'Career articles fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getPublicBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = typeof req.params.slug === 'string' ? req.params.slug : '';
      const data = await careerAdviceService.getPublicBySlug(slug);
      sendSuccess(res, data, 'Career article fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await careerAdviceService.create(
        requireAdmin(req),
        req.body as CareerArticleCreateInput,
      );
      sendSuccess(res, data, 'Career article created successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async listAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as AdminCareerAdviceQuery;
      const data = await careerAdviceService.listAdmin(query);
      sendSuccess(res, data, 'Admin career articles fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAdminById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await careerAdviceService.getAdminById(id);
      sendSuccess(res, data, 'Career article fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await careerAdviceService.update(id, req.body as CareerArticleUpdateInput);
      sendSuccess(res, data, 'Career article updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async publish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await careerAdviceService.publish(id);
      sendSuccess(res, data, 'Career article published successfully');
    } catch (error) {
      next(error);
    }
  }

  async unpublish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await careerAdviceService.unpublish(id);
      sendSuccess(res, data, 'Career article unpublished successfully');
    } catch (error) {
      next(error);
    }
  }

  async archive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await careerAdviceService.archive(id);
      sendSuccess(res, { article: data.article }, data.message);
    } catch (error) {
      next(error);
    }
  }
}

export const careerAdviceController = new CareerAdviceController();
