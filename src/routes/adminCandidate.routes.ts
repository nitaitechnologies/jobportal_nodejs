import { Router } from 'express';
import { adminManagementController } from '../controllers/adminManagement.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import {
  validateAdminCandidateListQuery,
  validateAdminCandidateStatus,
  validateAdminCandidateVisibility,
  validateAdminIdParam,
} from '../middlewares/adminManagementValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', requirePermission(PERMISSIONS.CANDIDATES_READ), validateAdminCandidateListQuery, (req, res, next) => {
  void adminManagementController.listCandidates(req, res, next);
});

router.get('/:id', requirePermission(PERMISSIONS.CANDIDATES_READ), validateAdminIdParam, (req, res, next) => {
  void adminManagementController.getCandidate(req, res, next);
});

router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.CANDIDATES_UPDATE),
  validateAdminIdParam,
  validateAdminCandidateStatus,
  (req, res, next) => {
    void adminManagementController.updateCandidateStatus(req, res, next);
  },
);

router.patch(
  '/:id/visibility',
  requirePermission(PERMISSIONS.CANDIDATES_UPDATE),
  validateAdminIdParam,
  validateAdminCandidateVisibility,
  (req, res, next) => {
    void adminManagementController.updateCandidateVisibility(req, res, next);
  },
);

export default router;
