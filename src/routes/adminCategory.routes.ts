import { Router } from 'express';
import { categoryController } from '../controllers/category.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import {
  validateAdminCategoryQuery,
  validateCategoryCreate,
  validateCategoryUpdate,
} from '../middlewares/categoryValidate.middleware';
import { validateObjectIdParam } from '../middlewares/objectIdParam.middleware';
import { PERMISSIONS } from '../constants/permissions';

const adminCategoryRouter = Router();

adminCategoryRouter.use(authenticate, requireAdmin);

adminCategoryRouter.post(
  '/',
  requirePermission(PERMISSIONS.CATEGORIES_CREATE),
  validateCategoryCreate,
  (req, res, next) => {
    void categoryController.create(req, res, next);
  },
);

adminCategoryRouter.get(
  '/',
  requirePermission(PERMISSIONS.CATEGORIES_READ),
  validateAdminCategoryQuery,
  (req, res, next) => {
    void categoryController.listAdmin(req, res, next);
  },
);

adminCategoryRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.CATEGORIES_READ),
  validateObjectIdParam('id'),
  (req, res, next) => {
    void categoryController.getAdminById(req, res, next);
  },
);

adminCategoryRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.CATEGORIES_UPDATE),
  validateObjectIdParam('id'),
  validateCategoryUpdate,
  (req, res, next) => {
    void categoryController.update(req, res, next);
  },
);

adminCategoryRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.CATEGORIES_DELETE),
  validateObjectIdParam('id'),
  (req, res, next) => {
    void categoryController.remove(req, res, next);
  },
);

export default adminCategoryRouter;
