import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { settingsService } from '../services/settings.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  AdminSettingCreateInput,
  AdminSettingListQuery,
  AdminSettingStatusInput,
  AdminSettingUpdateInput,
} from '../validators/settings.validator';

type ReqWithQuery = Request & { validatedQuery?: AdminSettingListQuery };

function requireAdmin(req: Request) {
  if (!req.admin) throw new AppError('Admin access required', HTTP_STATUS.FORBIDDEN);
  return req.admin;
}

function keyParam(req: Request): string {
  return typeof req.params.key === 'string' ? req.params.key : '';
}

export class SettingsController {
  async getPublic(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await settingsService.getPublicSettings();
      sendSuccess(res, { settings }, 'Public settings fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async listAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as ReqWithQuery).validatedQuery as AdminSettingListQuery;
      const data = await settingsService.listAdmin(query);
      sendSuccess(res, data, 'Settings fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAdminByKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await settingsService.getAdminByKey(keyParam(req));
      sendSuccess(res, data, 'Setting fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await settingsService.create(
        requireAdmin(req),
        req.body as AdminSettingCreateInput,
      );
      sendSuccess(res, data, 'Setting created successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await settingsService.update(
        requireAdmin(req),
        keyParam(req),
        req.body as AdminSettingUpdateInput,
      );
      sendSuccess(res, data, 'Setting updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await settingsService.updateStatus(
        requireAdmin(req),
        keyParam(req),
        req.body as AdminSettingStatusInput,
      );
      sendSuccess(res, data, 'Setting status updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const settingsController = new SettingsController();
