import { Router } from 'express';
import { subscriptionController } from '../controllers/subscription.controller';
import { couponController } from '../controllers/coupon.controller';
import { EMPLOYER_PERMISSIONS } from '../constants/employerPermissions';
import { authenticate } from '../middlewares/auth.middleware';
import {
  requireEmployer,
  requireEmployerPermission,
} from '../middlewares/employerAuth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validateCouponPreview } from '../middlewares/couponValidate.middleware';
import {
  validateEmployerAutoRenewUpdate,
  validateEmployerSubscriptionQuery,
  validateSubscriptionIdParam,
} from '../middlewares/subscriptionValidate.middleware';

/**
 * Employer subscription routes.
 * Mount under /employer — path segments are relative.
 */
const employerSubscriptionRouter = Router();

employerSubscriptionRouter.use(authenticate, requireRole('employer'), requireEmployer);

employerSubscriptionRouter.get('/subscription', (req, res, next) => {
  void subscriptionController.getCurrent(req, res, next);
});

employerSubscriptionRouter.get('/subscription/entitlements', (req, res, next) => {
  void subscriptionController.getEntitlements(req, res, next);
});

employerSubscriptionRouter.patch(
  '/subscription/auto-renew',
  requireEmployerPermission(EMPLOYER_PERMISSIONS.BILLING_MANAGE),
  validateEmployerAutoRenewUpdate,
  (req, res, next) => {
    void subscriptionController.updateAutoRenew(req, res, next);
  },
);

employerSubscriptionRouter.post(
  '/subscription/coupons/preview',
  requireEmployerPermission(EMPLOYER_PERMISSIONS.BILLING_MANAGE),
  validateCouponPreview,
  (req, res, next) => {
    void couponController.preview(req, res, next);
  },
);

employerSubscriptionRouter.get(
  '/subscriptions',
  validateEmployerSubscriptionQuery,
  (req, res, next) => {
    void subscriptionController.listHistory(req, res, next);
  },
);

employerSubscriptionRouter.get(
  '/subscription/:id',
  validateSubscriptionIdParam,
  (req, res, next) => {
    void subscriptionController.getById(req, res, next);
  },
);

export default employerSubscriptionRouter;
