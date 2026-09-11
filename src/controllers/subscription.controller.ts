import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { subscriptionPlanService } from '../services/subscriptionPlan.service';
import { subscriptionService } from '../services/subscription.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  AdminPlanQuery,
  AdminSubscriptionCreateInput,
  EmployerSubscriptionQuery,
  PublicPlanQuery,
  SubscriptionPlanCreateInput,
  SubscriptionPlanUpdateInput,
} from '../validators/subscription.validator';

type RequestWithValidatedQuery = Request & {
  validatedQuery?: PublicPlanQuery | AdminPlanQuery | EmployerSubscriptionQuery;
};

function requireEmployer(req: Request) {
  if (!req.employer) {
    throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
  }
  return req.employer;
}

export class SubscriptionController {
  async listPublicPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as PublicPlanQuery;
      const data = await subscriptionPlanService.listPublic(query);
      sendSuccess(res, data, 'Subscription plans fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getPublicPlanBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = typeof req.params.slug === 'string' ? req.params.slug : '';
      const data = await subscriptionPlanService.getPublicBySlug(slug);
      sendSuccess(res, data, 'Subscription plan fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async createPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await subscriptionPlanService.create(req.body as SubscriptionPlanCreateInput);
      sendSuccess(res, data, 'Subscription plan created successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async listAdminPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as AdminPlanQuery;
      const data = await subscriptionPlanService.listAdmin(query);
      sendSuccess(res, data, 'Admin subscription plans fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAdminPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await subscriptionPlanService.getAdminById(id);
      sendSuccess(res, data, 'Subscription plan fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async updatePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await subscriptionPlanService.update(
        id,
        req.body as SubscriptionPlanUpdateInput,
      );
      sendSuccess(res, data, 'Subscription plan updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deactivatePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await subscriptionPlanService.deactivate(id);
      sendSuccess(res, data, 'Subscription plan deactivated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCurrent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await subscriptionService.getCurrent(requireEmployer(req));
      sendSuccess(res, result.subscription, result.message);
    } catch (error) {
      next(error);
    }
  }

  async getEntitlements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await subscriptionService.getEntitlements(requireEmployer(req));
      sendSuccess(res, data, 'Entitlements fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async listHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery)
        .validatedQuery as EmployerSubscriptionQuery;
      const data = await subscriptionService.listHistory(requireEmployer(req), query);
      sendSuccess(res, data, 'Subscriptions fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await subscriptionService.getById(requireEmployer(req), id);
      sendSuccess(res, data, 'Subscription fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async adminActivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await subscriptionService.adminActivate(
        req.body as AdminSubscriptionCreateInput,
      );
      sendSuccess(res, data, 'Subscription activated successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }
}

export const subscriptionController = new SubscriptionController();
