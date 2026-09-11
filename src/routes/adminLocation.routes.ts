import { Router } from 'express';
import { locationController } from '../controllers/location.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import {
  validateAdminLocationQuery,
  validateLocationCreate,
  validateLocationUpdate,
} from '../middlewares/locationValidate.middleware';
import { validateObjectIdParam } from '../middlewares/objectIdParam.middleware';
import { PERMISSIONS } from '../constants/permissions';

const adminLocationRouter = Router();

adminLocationRouter.use(authenticate, requireAdmin);

adminLocationRouter.post(
  '/',
  requirePermission(PERMISSIONS.LOCATIONS_CREATE),
  validateLocationCreate,
  (req, res, next) => {
    void locationController.create(req, res, next);
  },
);

adminLocationRouter.get(
  '/',
  requirePermission(PERMISSIONS.LOCATIONS_READ),
  validateAdminLocationQuery,
  (req, res, next) => {
    void locationController.listAdmin(req, res, next);
  },
);

adminLocationRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.LOCATIONS_READ),
  validateObjectIdParam('id'),
  (req, res, next) => {
    void locationController.getAdminById(req, res, next);
  },
);

adminLocationRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.LOCATIONS_UPDATE),
  validateObjectIdParam('id'),
  validateLocationUpdate,
  (req, res, next) => {
    void locationController.update(req, res, next);
  },
);

adminLocationRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.LOCATIONS_DELETE),
  validateObjectIdParam('id'),
  (req, res, next) => {
    void locationController.remove(req, res, next);
  },
);

export default adminLocationRouter;
