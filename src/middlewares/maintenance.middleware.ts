import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { settingsService } from '../services/settings.service';
import { sendError } from '../utils/apiResponse';

/**
 * Maintenance mode gate (B24).
 * Always allows: health, admin auth, all /admin/* routes, and public settings.
 * Does not block admin recovery access.
 */
export async function maintenanceGate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const path = req.path || '';

    if (
      path.startsWith('/health') ||
      path.startsWith('/admin') ||
      path === '/settings/public' ||
      path.startsWith('/settings/public')
    ) {
      next();
      return;
    }

    const enabled = await settingsService.getBoolean('platform.maintenance.enabled', false);
    if (!enabled) {
      next();
      return;
    }

    const message = await settingsService.getString(
      'platform.maintenance.message',
      'WorkIndia is temporarily under maintenance. Please try again shortly.',
    );

    sendError(res, message, HTTP_STATUS.SERVICE_UNAVAILABLE, [
      { path: 'maintenance', message: 'Platform is in maintenance mode' },
    ]);
  } catch {
    // Fail open if settings cannot be read so core APIs stay available.
    next();
  }
}
