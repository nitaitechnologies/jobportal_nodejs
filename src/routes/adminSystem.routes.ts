import { Request, Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import { PERMISSIONS } from '../constants/permissions';
import { backupService } from '../services/backup.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants';
import type { AuthenticatedAdmin } from '../types/auth.types';

const router = Router();
router.use(authenticate, requireAdmin);

function requireAdminActor(req: Request): AuthenticatedAdmin {
  if (!req.admin) throw new AppError('Admin access required', HTTP_STATUS.FORBIDDEN);
  return req.admin;
}

router.get('/backups', requirePermission(PERMISSIONS.SETTINGS_READ), (_req, res, next) => {
  void (async () => {
    try {
      const data = await backupService.list();
      sendSuccess(res, data, 'Backups listed successfully');
    } catch (error) {
      next(error);
    }
  })();
});

router.post('/backups', requirePermission(PERMISSIONS.SETTINGS_UPDATE), (req, res, next) => {
  void (async () => {
    try {
      const data = await backupService.create(requireAdminActor(req));
      sendSuccess(res, data, 'Backup created successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  })();
});

router.post('/backups/:name/restore', requirePermission(PERMISSIONS.SETTINGS_UPDATE), (req, res, next) => {
  void (async () => {
    try {
      const name = typeof req.params.name === 'string' ? req.params.name : '';
      const dryRun =
        req.query.dryRun === 'true' ||
        req.query.dryRun === '1' ||
        (req.body as { dryRun?: boolean })?.dryRun === true;
      const data = await backupService.restore(requireAdminActor(req), { name, dryRun });
      sendSuccess(res, data, dryRun ? 'Backup restore dry-run OK' : 'Backup restored successfully');
    } catch (error) {
      next(error);
    }
  })();
});

export default router;
