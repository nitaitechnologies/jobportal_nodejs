import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { companyService } from '../services/company.service';
import type { AuthenticatedCandidate } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  CompanyJobsQuery,
  CompanyProfileUpdateInput,
  CompanyReviewCreateInput,
  CompanyReviewsQuery,
  CompanyReviewUpdateInput,
} from '../validators/employerCompany.validator';
import '../types/express';

function requireCandidateContext(req: Request): AuthenticatedCandidate {
  if (!req.candidate) {
    throw new AppError('Candidate context required', HTTP_STATUS.UNAUTHORIZED);
  }
  return req.candidate;
}

export class CompanyController {
  async getOwnedCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
      }

      const data = await companyService.getOwnedCompany(req.auth.userId);
      sendSuccess(res, data, 'Company profile fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateOwnedCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
      }

      const data = await companyService.updateOwnedCompany(
        req.auth.userId,
        req.body as CompanyProfileUpdateInput,
      );
      sendSuccess(res, data, 'Company profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getPublicBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = typeof req.params.slug === 'string' ? req.params.slug : '';
      const data = await companyService.getPublicCompanyBySlug(slug);
      sendSuccess(res, data, 'Company profile fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async listPublicFeatured(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const raw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 12;
      const limit = Number.isFinite(raw) ? raw : 12;
      const data = await companyService.listPublicFeatured(limit);
      sendSuccess(res, data, 'Featured companies fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async listPublicJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = typeof req.params.slug === 'string' ? req.params.slug : '';
      const query =
        (req as Request & { validatedQuery?: CompanyJobsQuery }).validatedQuery ?? {
          page: 1,
          limit: 20,
        };
      const data = await companyService.listPublicJobsBySlug(slug, query);
      sendSuccess(res, data, 'Company jobs fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async listReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = typeof req.params.slug === 'string' ? req.params.slug : '';
      const query =
        (req as Request & { validatedQuery?: CompanyReviewsQuery }).validatedQuery ?? {
          page: 1,
          limit: 10,
        };
      const data = await companyService.listPublishedReviews(slug, query);
      sendSuccess(res, data, 'Company reviews fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async upsertReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slug = typeof req.params.slug === 'string' ? req.params.slug : '';
      const data = await companyService.upsertMyReview(
        requireCandidateContext(req),
        slug,
        req.body as CompanyReviewCreateInput,
      );
      sendSuccess(res, data, 'Company review saved successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async updateReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await companyService.updateMyReview(
        requireCandidateContext(req),
        id,
        req.body as CompanyReviewUpdateInput,
      );
      sendSuccess(res, data, 'Company review updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await companyService.deleteMyReview(requireCandidateContext(req), id);
      sendSuccess(res, data, 'Company review deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const companyController = new CompanyController();
