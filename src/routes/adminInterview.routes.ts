import { Router } from 'express';
import { adminManagementController } from '../controllers/adminManagement.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import {
  validateAdminIdParam,
  validateAdminInterviewListQuery,
} from '../middlewares/adminManagementValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticate, requireAdmin);

router.get(
  '/',
  requirePermission(PERMISSIONS.INTERVIEWS_READ),
  validateAdminInterviewListQuery,
  (req, res, next) => {
    void adminManagementController.listInterviews(req, res, next);
  },
);

router.get('/:id', requirePermission(PERMISSIONS.INTERVIEWS_READ), validateAdminIdParam, (req, res, next) => {
  void adminManagementController.getInterview(req, res, next);
});

export default router;
