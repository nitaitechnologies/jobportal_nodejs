import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { locationService } from '../services/location.service';
import { sendSuccess } from '../utils/apiResponse';
import type {
  AdminLocationQuery,
  LocationCreateInput,
  LocationUpdateInput,
  PublicLocationQuery,
} from '../validators/location.validator';

type RequestWithValidatedQuery = Request & {
  validatedQuery?: PublicLocationQuery | AdminLocationQuery;
};

export class LocationController {
  async listPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as PublicLocationQuery;
      const data = await locationService.listPublic(query);
      sendSuccess(res, data, 'Locations fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getPublicBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = typeof req.params.slug === 'string' ? req.params.slug : '';
      const data = await locationService.getPublicBySlug(slug);
      sendSuccess(res, data, 'Location fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getChildren(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = typeof req.params.slug === 'string' ? req.params.slug : '';
      const data = await locationService.getPublicChildren(slug);
      sendSuccess(res, data, 'Child locations fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await locationService.create(req.body as LocationCreateInput);
      sendSuccess(res, data, 'Location created successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async listAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as AdminLocationQuery;
      const data = await locationService.listAdmin(query);
      sendSuccess(res, data, 'Admin locations fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAdminById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await locationService.getAdminById(id);
      sendSuccess(res, data, 'Location fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await locationService.update(id, req.body as LocationUpdateInput);
      sendSuccess(res, data, 'Location updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await locationService.remove(id);
      const message = data.deactivated
        ? 'Location deactivated because it has dependencies'
        : 'Location deleted successfully';
      sendSuccess(res, data, message);
    } catch (error) {
      next(error);
    }
  }
}

export const locationController = new LocationController();
