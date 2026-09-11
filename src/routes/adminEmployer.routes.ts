import { Router } from 'express';
import { adminManagementController } from '../controllers/adminManagement.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import {
  validateAdminEmployerListQuery,
  validateAdminEmployerStatus,
  validateAdminIdParam,
} from '../middlewares/adminManagementValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', requirePermission(PERMISSIONS.EMPLOYERS_READ), validateAdminEmployerListQuery, (req, res, next) => {
  void adminManagementController.listEmployers(req, res, next);
});

router.get('/:id', requirePermission(PERMISSIONS.EMPLOYERS_READ), validateAdminIdParam, (req, res, next) => {
  void adminManagementController.getEmployer(req, res, next);
});

router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.EMPLOYERS_UPDATE),
  validateAdminIdParam,
  validateAdminEmployerStatus,
  (req, res, next) => {
    void adminManagementController.updateEmployerStatus(req, res, next);
  },
);

export default router;
