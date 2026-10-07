import { Router } from 'express';
import { referralController } from '../controllers/referral.controller';
import { authenticate } from '../middlewares/auth.middleware';
import {
  requireAdmin,
  requireAdminRole,
  requirePermission,
} from '../middlewares/adminAuth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { PERMISSIONS } from '../constants/permissions';
import { adminReferralPointsSchema } from '../validators/referral.validator';

const adminReferralRouter = Router();

adminReferralRouter.use(authenticate, requireAdmin);

adminReferralRouter.get('/', requirePermission(PERMISSIONS.SETTINGS_READ), (req, res, next) => {
  void referralController.adminOverview(req, res, next);
});

adminReferralRouter.patch(
  '/points',
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  requireAdminRole('super_admin', 'admin'),
  validateBody(adminReferralPointsSchema),
  (req, res, next) => {
    void referralController.adminSetPoints(req, res, next);
  },
);

export default adminReferralRouter;
