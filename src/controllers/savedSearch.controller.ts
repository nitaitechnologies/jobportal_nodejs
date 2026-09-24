import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { savedSearchService } from '../services/savedSearch.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  AlertSettingsUpdateInput,
  SavedSearchCreateInput,
  SavedSearchQuery,
  SavedSearchUpdateInput,
} from '../validators/savedSearch.validator';

type RequestWithValidatedQuery = Request & { validatedQuery?: SavedSearchQuery };

function requireCandidateContext(req: Request) {
  if (!req.candidate) {
    throw new AppError('Candidate access required', HTTP_STATUS.FORBIDDEN);
  }
  return req.candidate;
}

export class SavedSearchController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as SavedSearchQuery;
      const data = await savedSearchService.list(requireCandidateContext(req), query);
      sendSuccess(res, data, 'Saved searches fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await savedSearchService.create(
        requireCandidateContext(req),
        req.body as SavedSearchCreateInput,
      );
      sendSuccess(res, data, 'Saved search created successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await savedSearchService.getById(requireCandidateContext(req), id);
      sendSuccess(res, data, 'Saved search fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await savedSearchService.update(
        requireCandidateContext(req),
        id,
        req.body as SavedSearchUpdateInput,
      );
      sendSuccess(res, data, 'Saved search updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await savedSearchService.remove(requireCandidateContext(req), id);
      sendSuccess(res, data, 'Saved search deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAlertSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await savedSearchService.getAlertSettings(requireCandidateContext(req));
      sendSuccess(res, data, 'Alert settings fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateAlertSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await savedSearchService.updateAlertSettings(
        requireCandidateContext(req),
        req.body as AlertSettingsUpdateInput,
      );
      sendSuccess(res, data, 'Alert settings updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const savedSearchController = new SavedSearchController();
