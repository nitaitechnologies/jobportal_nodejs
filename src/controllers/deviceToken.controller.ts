import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { pushService } from '../services/push.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';

function requireUserId(req: Request): string {
  if (!req.auth?.userId) {
    throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
  }
  return req.auth.userId;
}

export class DeviceTokenController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body as {
        token?: string;
        platform?: 'android' | 'ios' | 'web';
        app?: 'candidate' | 'employer' | 'admin';
      };
      if (!body.token?.trim()) {
        throw new AppError('token is required', HTTP_STATUS.BAD_REQUEST, [
          { path: 'token', message: 'Required' },
        ]);
      }
      const role = req.auth?.role;
      const app =
        body.app ??
        (role === 'employer' ? 'employer' : role === 'admin' ? 'admin' : 'candidate');
      const data = await pushService.registerDeviceToken({
        userId: requireUserId(req),
        token: body.token,
        platform: body.platform,
        app,
      });
      sendSuccess(res, data, 'Device token registered', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async unregister(req: Request, res: Response, next: NextFunction) {
    try {
      const token =
        typeof (req.body as { token?: string }).token === 'string'
          ? (req.body as { token: string }).token
          : '';
      if (!token.trim()) {
        throw new AppError('token is required', HTTP_STATUS.BAD_REQUEST, [
          { path: 'token', message: 'Required' },
        ]);
      }
      const data = await pushService.unregisterDeviceToken(requireUserId(req), token);
      sendSuccess(res, data, 'Device token unregistered');
    } catch (error) {
      next(error);
    }
  }
}

export const deviceTokenController = new DeviceTokenController();
