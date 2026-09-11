import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { analyticsService } from '../services/analytics.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  AdminAnalyticsEventsQuery,
  AdminAnalyticsOverviewQuery,
  AdminAnalyticsPagedQuery,
} from '../validators/analytics.validator';

type RequestWithValidatedQuery = Request & {
  validatedQuery?:
    | AdminAnalyticsOverviewQuery
    | AdminAnalyticsEventsQuery
    | AdminAnalyticsPagedQuery;
};

function requireEmployer(req: Request) {
  if (!req.employer) {
    throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
  }
  return req.employer;
}

export class AnalyticsController {
  async overview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery)
        .validatedQuery as AdminAnalyticsOverviewQuery;
      const data = await analyticsService.getAdminOverview(query);
      sendSuccess(res, data, 'Analytics overview fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async events(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery)
        .validatedQuery as AdminAnalyticsEventsQuery;
      const data = await analyticsService.listAdminEvents(query);
      sendSuccess(res, data, 'Analytics events fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async jobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery)
        .validatedQuery as AdminAnalyticsPagedQuery;
      const data = await analyticsService.getAdminJobs(query);
      sendSuccess(res, data, 'Job analytics fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async employers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery)
        .validatedQuery as AdminAnalyticsPagedQuery;
      const data = await analyticsService.getAdminEmployers(query);
      sendSuccess(res, data, 'Employer analytics fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async candidates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery)
        .validatedQuery as AdminAnalyticsPagedQuery;
      const data = await analyticsService.getAdminCandidates(query);
      sendSuccess(res, data, 'Candidate analytics fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async categories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery)
        .validatedQuery as AdminAnalyticsPagedQuery;
      const data = await analyticsService.getAdminCategories(query);
      sendSuccess(res, data, 'Category analytics fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async locations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery)
        .validatedQuery as AdminAnalyticsPagedQuery;
      const data = await analyticsService.getAdminLocations(query);
      sendSuccess(res, data, 'Location analytics fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async employerOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery)
        .validatedQuery as AdminAnalyticsOverviewQuery;
      const data = await analyticsService.getEmployerOverview(requireEmployer(req), query);
      sendSuccess(res, data, 'Employer analytics fetched successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const analyticsController = new AnalyticsController();
