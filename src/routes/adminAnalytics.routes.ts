import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import {
  validateAdminAnalyticsEvents,
  validateAdminAnalyticsOverview,
  validateAdminAnalyticsPaged,
} from '../middlewares/analyticsValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const adminAnalyticsRouter = Router();

adminAnalyticsRouter.use(authenticate, requireAdmin);

adminAnalyticsRouter.get(
  '/overview',
  requirePermission(PERMISSIONS.ANALYTICS_READ),
  validateAdminAnalyticsOverview,
  (req, res, next) => {
    void analyticsController.overview(req, res, next);
  },
);

adminAnalyticsRouter.get(
  '/events',
  requirePermission(PERMISSIONS.ANALYTICS_READ),
  validateAdminAnalyticsEvents,
  (req, res, next) => {
    void analyticsController.events(req, res, next);
  },
);

adminAnalyticsRouter.get(
  '/jobs',
  requirePermission(PERMISSIONS.ANALYTICS_READ),
  validateAdminAnalyticsPaged,
  (req, res, next) => {
    void analyticsController.jobs(req, res, next);
  },
);

adminAnalyticsRouter.get(
  '/employers',
  requirePermission(PERMISSIONS.ANALYTICS_READ),
  validateAdminAnalyticsPaged,
  (req, res, next) => {
    void analyticsController.employers(req, res, next);
  },
);

adminAnalyticsRouter.get(
  '/candidates',
  requirePermission(PERMISSIONS.ANALYTICS_READ),
  validateAdminAnalyticsPaged,
  (req, res, next) => {
    void analyticsController.candidates(req, res, next);
  },
);

adminAnalyticsRouter.get(
  '/categories',
  requirePermission(PERMISSIONS.ANALYTICS_READ),
  validateAdminAnalyticsPaged,
  (req, res, next) => {
    void analyticsController.categories(req, res, next);
  },
);

adminAnalyticsRouter.get(
  '/locations',
  requirePermission(PERMISSIONS.ANALYTICS_READ),
  validateAdminAnalyticsPaged,
  (req, res, next) => {
    void analyticsController.locations(req, res, next);
  },
);

export default adminAnalyticsRouter;
