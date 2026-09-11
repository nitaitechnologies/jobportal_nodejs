import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { reportService } from '../services/report.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  AdminReportQuery,
  ReportAdminUpdateInput,
  ReportCreateInput,
  UserReportQuery,
} from '../validators/report.validator';

type RequestWithValidatedQuery = Request & {
  validatedQuery?: UserReportQuery | AdminReportQuery;
};

function requireUserId(req: Request): string {
  if (!req.auth?.userId) {
    throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
  }
  return req.auth.userId;
}

function requireAdmin(req: Request) {
  if (!req.admin) {
    throw new AppError('Admin access required', HTTP_STATUS.FORBIDDEN);
  }
  return req.admin;
}

export class ReportController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await reportService.create(
        requireUserId(req),
        req.body as ReportCreateInput,
      );
      sendSuccess(res, data, 'Report submitted successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async listMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as UserReportQuery;
      const data = await reportService.listMine(requireUserId(req), query);
      sendSuccess(res, data, 'Reports fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getMineById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await reportService.getMineById(requireUserId(req), id);
      sendSuccess(res, data, 'Report fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async listAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as AdminReportQuery;
      const data = await reportService.listAdmin(query);
      sendSuccess(res, data, 'Admin reports fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAdminById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await reportService.getAdminById(id);
      sendSuccess(res, data, 'Report fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await reportService.updateAdmin(
        requireAdmin(req),
        id,
        req.body as ReportAdminUpdateInput,
      );
      sendSuccess(res, data, 'Report updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const reportController = new ReportController();
