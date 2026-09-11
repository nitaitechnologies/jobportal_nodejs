import { Router } from 'express';
import { subscriptionController } from '../controllers/subscription.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import {
  validateAdminPlanQuery,
  validatePlanCreate,
  validatePlanIdParam,
  validatePlanUpdate,
} from '../middlewares/subscriptionValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const adminSubscriptionPlanRouter = Router();

adminSubscriptionPlanRouter.use(authenticate, requireAdmin);

adminSubscriptionPlanRouter.post(
  '/',
  requirePermission(PERMISSIONS.PLANS_CREATE),
  validatePlanCreate,
  (req, res, next) => {
    void subscriptionController.createPlan(req, res, next);
  },
);

adminSubscriptionPlanRouter.get(
  '/',
  requirePermission(PERMISSIONS.PLANS_READ),
  validateAdminPlanQuery,
  (req, res, next) => {
    void subscriptionController.listAdminPlans(req, res, next);
  },
);

adminSubscriptionPlanRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.PLANS_READ),
  validatePlanIdParam,
  (req, res, next) => {
    void subscriptionController.getAdminPlan(req, res, next);
  },
);

adminSubscriptionPlanRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.PLANS_UPDATE),
  validatePlanIdParam,
  validatePlanUpdate,
  (req, res, next) => {
    void subscriptionController.updatePlan(req, res, next);
  },
);

adminSubscriptionPlanRouter.patch(
  '/:id/deactivate',
  requirePermission(PERMISSIONS.PLANS_UPDATE),
  validatePlanIdParam,
  (req, res, next) => {
    void subscriptionController.deactivatePlan(req, res, next);
  },
);

export default adminSubscriptionPlanRouter;
