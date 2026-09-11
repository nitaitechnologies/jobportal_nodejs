import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { notificationService } from '../services/notification.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type { NotificationQuery } from '../validators/notification.validator';

type RequestWithValidatedQuery = Request & {
  validatedQuery?: NotificationQuery;
};

function requireUserId(req: Request): string {
  if (!req.auth?.userId) {
    throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
  }
  return req.auth.userId;
}

export class NotificationController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as NotificationQuery;
      const data = await notificationService.list(requireUserId(req), query);
      sendSuccess(res, data, 'Notifications fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async unreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await notificationService.unreadCount(requireUserId(req));
      sendSuccess(res, data, 'Unread notification count fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await notificationService.getById(requireUserId(req), id);
      sendSuccess(res, data, 'Notification fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await notificationService.markRead(requireUserId(req), id);
      sendSuccess(res, data, 'Notification marked as read');
    } catch (error) {
      next(error);
    }
  }

  async markUnread(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await notificationService.markUnread(requireUserId(req), id);
      sendSuccess(res, data, 'Notification marked as unread');
    } catch (error) {
      next(error);
    }
  }

  async markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await notificationService.markAllRead(requireUserId(req));
      sendSuccess(res, data, 'Notifications marked as read');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await notificationService.delete(requireUserId(req), id);
      sendSuccess(res, data, 'Notification deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
