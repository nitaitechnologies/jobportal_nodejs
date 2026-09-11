import { Router } from 'express';
import { subscriptionController } from '../controllers/subscription.controller';
import {
  validatePlanSlugParam,
  validatePublicPlanQuery,
} from '../middlewares/subscriptionValidate.middleware';

const subscriptionPlanRouter = Router();

subscriptionPlanRouter.get('/', validatePublicPlanQuery, (req, res, next) => {
  void subscriptionController.listPublicPlans(req, res, next);
});

subscriptionPlanRouter.get('/:slug', validatePlanSlugParam, (req, res, next) => {
  void subscriptionController.getPublicPlanBySlug(req, res, next);
});

export default subscriptionPlanRouter;
