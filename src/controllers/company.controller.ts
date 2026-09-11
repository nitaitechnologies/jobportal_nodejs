import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { companyService } from '../services/company.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type { CompanyProfileUpdateInput } from '../validators/employerCompany.validator';
import '../types/express';

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
}

export const companyController = new CompanyController();
