import { Router } from 'express';
import { adminManagementController } from '../controllers/adminManagement.controller';
import { authenticate } from '../middlewares/auth.middleware';
import {
  requireAdmin,
  requireAnyPermission,
  requirePermission,
} from '../middlewares/adminAuth.middleware';
import {
  validateAdminIdParam,
  validateAdminJobFeature,
  validateAdminJobListQuery,
  validateAdminJobStatus,
  validateAdminJobUrgent,
} from '../middlewares/adminManagementValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', requirePermission(PERMISSIONS.JOBS_READ), validateAdminJobListQuery, (req, res, next) => {
  void adminManagementController.listJobs(req, res, next);
});

router.get('/:id', requirePermission(PERMISSIONS.JOBS_READ), validateAdminIdParam, (req, res, next) => {
  void adminManagementController.getJob(req, res, next);
});

router.patch(
  '/:id/status',
  requireAnyPermission(
    PERMISSIONS.JOBS_APPROVE,
    PERMISSIONS.JOBS_REJECT,
    PERMISSIONS.JOBS_UPDATE,
  ),
  validateAdminIdParam,
  validateAdminJobStatus,
  (req, res, next) => {
    void adminManagementController.updateJobStatus(req, res, next);
  },
);

router.patch(
  '/:id/feature',
  requirePermission(PERMISSIONS.JOBS_UPDATE),
  validateAdminIdParam,
  validateAdminJobFeature,
  (req, res, next) => {
    void adminManagementController.updateJobFeature(req, res, next);
  },
);

router.patch(
  '/:id/urgent',
  requirePermission(PERMISSIONS.JOBS_UPDATE),
  validateAdminIdParam,
  validateAdminJobUrgent,
  (req, res, next) => {
    void adminManagementController.updateJobUrgent(req, res, next);
  },
);

export default router;
