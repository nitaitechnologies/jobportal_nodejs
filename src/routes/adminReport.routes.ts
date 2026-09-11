import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import {
  validateAdminReportQuery,
  validateReportAdminUpdate,
  validateReportIdParam,
} from '../middlewares/reportValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const adminReportRouter = Router();

adminReportRouter.use(authenticate, requireAdmin);

adminReportRouter.get(
  '/',
  requirePermission(PERMISSIONS.REPORTS_READ),
  validateAdminReportQuery,
  (req, res, next) => {
    void reportController.listAdmin(req, res, next);
  },
);

adminReportRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.REPORTS_READ),
  validateReportIdParam,
  (req, res, next) => {
    void reportController.getAdminById(req, res, next);
  },
);

adminReportRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.REPORTS_RESOLVE),
  validateReportIdParam,
  validateReportAdminUpdate,
  (req, res, next) => {
    void reportController.updateAdmin(req, res, next);
  },
);

export default adminReportRouter;
