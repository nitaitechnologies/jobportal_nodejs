import { Router } from 'express';
import { subscriptionController } from '../controllers/subscription.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireEmployer } from '../middlewares/employerAuth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import {
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
