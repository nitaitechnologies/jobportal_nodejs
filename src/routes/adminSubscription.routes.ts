import { Router } from 'express';
import { subscriptionController } from '../controllers/subscription.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import { validateAdminSubscriptionCreate } from '../middlewares/subscriptionValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const adminSubscriptionRouter = Router();

adminSubscriptionRouter.use(authenticate, requireAdmin);

adminSubscriptionRouter.post(
  '/',
  requirePermission(PERMISSIONS.SUBSCRIPTIONS_MANAGE),
  validateAdminSubscriptionCreate,
  (req, res, next) => {
    void subscriptionController.adminActivate(req, res, next);
  },
);

export default adminSubscriptionRouter;
