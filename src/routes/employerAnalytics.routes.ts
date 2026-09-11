import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireEmployer } from '../middlewares/employerAuth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validateAdminAnalyticsOverview } from '../middlewares/analyticsValidate.middleware';

const employerAnalyticsRouter = Router();

employerAnalyticsRouter.get(
  '/analytics',
  authenticate,
  requireRole('employer'),
  requireEmployer,
  validateAdminAnalyticsOverview,
  (req, res, next) => {
    void analyticsController.employerOverview(req, res, next);
  },
);

export default employerAnalyticsRouter;
