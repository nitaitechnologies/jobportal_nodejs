import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller';
import { authenticate } from '../middlewares/auth.middleware';
import {
  requireAdmin,
  requireAdminRole,
  requirePermission,
} from '../middlewares/adminAuth.middleware';
import {
  validateAdminSettingCreate,
  validateAdminSettingKeyParam,
  validateAdminSettingListQuery,
  validateAdminSettingStatus,
  validateAdminSettingUpdate,
} from '../middlewares/settingsValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const adminSettingsRouter = Router();

adminSettingsRouter.use(authenticate, requireAdmin);

adminSettingsRouter.get(
  '/',
  requirePermission(PERMISSIONS.SETTINGS_READ),
  validateAdminSettingListQuery,
  (req, res, next) => {
    void settingsController.listAdmin(req, res, next);
  },
);

adminSettingsRouter.get(
  '/:key',
  requirePermission(PERMISSIONS.SETTINGS_READ),
  validateAdminSettingKeyParam,
  (req, res, next) => {
    void settingsController.getAdminByKey(req, res, next);
  },
);

adminSettingsRouter.post(
  '/',
  requirePermission(PERMISSIONS.SETTINGS_CREATE),
  requireAdminRole('super_admin', 'admin'),
  validateAdminSettingCreate,
  (req, res, next) => {
    void settingsController.create(req, res, next);
  },
);

adminSettingsRouter.patch(
  '/:key',
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  requireAdminRole('super_admin', 'admin'),
  validateAdminSettingKeyParam,
  validateAdminSettingUpdate,
  (req, res, next) => {
    void settingsController.update(req, res, next);
  },
);

adminSettingsRouter.patch(
  '/:key/status',
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  requireAdminRole('super_admin', 'admin'),
  validateAdminSettingKeyParam,
  validateAdminSettingStatus,
  (req, res, next) => {
    void settingsController.updateStatus(req, res, next);
  },
);

export default adminSettingsRouter;
