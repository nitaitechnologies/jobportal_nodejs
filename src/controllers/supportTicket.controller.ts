import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { supportTicketService } from '../services/supportTicket.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  SupportTicketCreateInput,
  SupportTicketQuery,
  SupportTicketUpdateInput,
} from '../validators/supportTicket.validator';
import type { AuthenticatedAdmin } from '../types/auth.types';

type RequestWithValidatedQuery = Request & {
  validatedQuery?: SupportTicketQuery;
};

function requireAdmin(req: Request): AuthenticatedAdmin {
  if (!req.admin) throw new AppError('Admin access required', HTTP_STATUS.FORBIDDEN);
  return req.admin;
}

export class SupportTicketController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.auth ?? null;
      const data = await supportTicketService.create(
        req.body as SupportTicketCreateInput,
        user,
      );
      sendSuccess(res, data, 'Support ticket created successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async listMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as SupportTicketQuery;
      const userId = req.auth?.userId;
      if (!userId) {
        sendSuccess(
          res,
          { tickets: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
          'No tickets',
        );
        return;
      }
      const data = await supportTicketService.listMine(userId, query);
      sendSuccess(res, data, 'Support tickets fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async listCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, supportTicketService.listCategories(), 'Support ticket categories fetched');
    } catch (error) {
      next(error);
    }
  }

  async adminList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as SupportTicketQuery;
      const data = await supportTicketService.adminList(query);
      sendSuccess(res, data, 'Admin support tickets fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async adminGet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await supportTicketService.adminGet(id);
      sendSuccess(res, data, 'Support ticket fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async adminUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await supportTicketService.adminUpdate(
        requireAdmin(req),
        id,
        req.body as SupportTicketUpdateInput,
      );
      sendSuccess(res, data, 'Support ticket updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const supportTicketController = new SupportTicketController();
