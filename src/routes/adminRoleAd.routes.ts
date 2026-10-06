import { Router } from 'express';
import { roleAdController } from '../controllers/roleAd.controller';
import { PERMISSIONS } from '../constants/permissions';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import {
  validateRoleAdClickQuery,
  validateRoleAdCreate,
  validateRoleAdIdParam,
  validateRoleAdQuery,
  validateRoleAdUpdate,
} from '../middlewares/roleAdValidate.middleware';

const adminRoleAdRouter = Router();

adminRoleAdRouter.use(authenticate, requireAdmin);

adminRoleAdRouter.get(
  '/',
  requirePermission(PERMISSIONS.ARTICLES_READ),
  validateRoleAdQuery,
  (req, res, next) => {
    void roleAdController.list(req, res, next);
  },
);

adminRoleAdRouter.post(
  '/',
  requirePermission(PERMISSIONS.ARTICLES_CREATE),
  validateRoleAdCreate,
  (req, res, next) => {
    void roleAdController.create(req, res, next);
  },
);

adminRoleAdRouter.get(
  '/:id/clicks',
  requirePermission(PERMISSIONS.ARTICLES_READ),
  validateRoleAdIdParam,
  validateRoleAdClickQuery,
  (req, res, next) => {
    void roleAdController.clicks(req, res, next);
  },
);

adminRoleAdRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.ARTICLES_READ),
  validateRoleAdIdParam,
  (req, res, next) => {
    void roleAdController.getById(req, res, next);
  },
);

adminRoleAdRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.ARTICLES_UPDATE),
  validateRoleAdIdParam,
  validateRoleAdUpdate,
  (req, res, next) => {
    void roleAdController.update(req, res, next);
  },
);

adminRoleAdRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.ARTICLES_DELETE),
  validateRoleAdIdParam,
  (req, res, next) => {
    void roleAdController.remove(req, res, next);
  },
);

export default adminRoleAdRouter;
