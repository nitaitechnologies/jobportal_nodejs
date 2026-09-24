import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import {
  validatePaymentIdParam,
  validatePaymentQuery,
  validatePaymentRefund,
  validatePaymentRevenueQuery,
} from '../middlewares/paymentValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const adminPaymentRouter = Router();

adminPaymentRouter.use(authenticate, requireAdmin);

adminPaymentRouter.get(
  '/',
  requirePermission(PERMISSIONS.SUBSCRIPTIONS_MANAGE),
  validatePaymentQuery,
  (req, res, next) => {
    void paymentController.adminList(req, res, next);
  },
);

adminPaymentRouter.get(
  '/revenue',
  requirePermission(PERMISSIONS.SUBSCRIPTIONS_MANAGE),
  validatePaymentRevenueQuery,
  (req, res, next) => {
    void paymentController.adminRevenue(req, res, next);
  },
);

adminPaymentRouter.post(
  '/:id/refund',
  requirePermission(PERMISSIONS.SUBSCRIPTIONS_MANAGE),
  validatePaymentIdParam,
  validatePaymentRefund,
  (req, res, next) => {
    void paymentController.adminRefund(req, res, next);
  },
);

export default adminPaymentRouter;
