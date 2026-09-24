import { Router } from 'express';
import { couponController } from '../controllers/coupon.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import {
  validateCouponCreate,
  validateCouponIdParam,
  validateCouponQuery,
  validateCouponUpdate,
} from '../middlewares/couponValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const adminCouponRouter = Router();

adminCouponRouter.use(authenticate, requireAdmin);

adminCouponRouter.post(
  '/',
  requirePermission(PERMISSIONS.SUBSCRIPTIONS_MANAGE),
  validateCouponCreate,
  (req, res, next) => {
    void couponController.create(req, res, next);
  },
);

adminCouponRouter.get(
  '/',
  requirePermission(PERMISSIONS.SUBSCRIPTIONS_MANAGE),
  validateCouponQuery,
  (req, res, next) => {
    void couponController.list(req, res, next);
  },
);

adminCouponRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.SUBSCRIPTIONS_MANAGE),
  validateCouponIdParam,
  (req, res, next) => {
    void couponController.getById(req, res, next);
  },
);

adminCouponRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.SUBSCRIPTIONS_MANAGE),
  validateCouponIdParam,
  validateCouponUpdate,
  (req, res, next) => {
    void couponController.update(req, res, next);
  },
);

adminCouponRouter.patch(
  '/:id/deactivate',
  requirePermission(PERMISSIONS.SUBSCRIPTIONS_MANAGE),
  validateCouponIdParam,
  (req, res, next) => {
    void couponController.deactivate(req, res, next);
  },
);

export default adminCouponRouter;
