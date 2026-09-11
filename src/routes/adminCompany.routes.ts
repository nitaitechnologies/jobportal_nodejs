import { Router } from 'express';
import { adminManagementController } from '../controllers/adminManagement.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import {
  validateAdminCompanyListQuery,
  validateAdminCompanyStatus,
  validateAdminCompanyVerification,
  validateAdminIdParam,
} from '../middlewares/adminManagementValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', requirePermission(PERMISSIONS.COMPANIES_READ), validateAdminCompanyListQuery, (req, res, next) => {
  void adminManagementController.listCompanies(req, res, next);
});

router.get('/:id', requirePermission(PERMISSIONS.COMPANIES_READ), validateAdminIdParam, (req, res, next) => {
  void adminManagementController.getCompany(req, res, next);
});

router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.COMPANIES_UPDATE),
  validateAdminIdParam,
  validateAdminCompanyStatus,
  (req, res, next) => {
    void adminManagementController.updateCompanyStatus(req, res, next);
  },
);

router.patch(
  '/:id/verification',
  requirePermission(PERMISSIONS.COMPANIES_VERIFY),
  validateAdminIdParam,
  validateAdminCompanyVerification,
  (req, res, next) => {
    void adminManagementController.updateCompanyVerification(req, res, next);
  },
);

export default router;
