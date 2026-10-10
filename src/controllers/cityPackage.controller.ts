import type { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { cityPackageService } from '../services/cityPackage.service';
import { sendSuccess } from '../utils/apiResponse';
import type {
  CityPackageCreateInput,
  CityPackageUpdateInput,
  CustomProposalCreateInput,
} from '../validators/cityPackage.validator';

export class CityPackageController {
  async adminList(req: Request, res: Response, next: NextFunction) {
    try {
      const city = typeof req.query.city === 'string' ? req.query.city : undefined;
      const data = await cityPackageService.listAdmin(city);
      sendSuccess(res, data, 'City packages fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async adminCreate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await cityPackageService.create(req.body as CityPackageCreateInput);
      sendSuccess(res, data, 'City package created', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async adminUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await cityPackageService.update(
        String(req.params.id),
        req.body as CityPackageUpdateInput,
      );
      sendSuccess(res, data, 'City package updated');
    } catch (error) {
      next(error);
    }
  }

  async searchCompanies(req: Request, res: Response, next: NextFunction) {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const data = await cityPackageService.searchCompanies(q);
      sendSuccess(res, data, 'Companies fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async createProposal(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body as CustomProposalCreateInput;
      const data = await cityPackageService.createProposal({
        ...body,
        createdBy: req.admin?.userId,
      });
      sendSuccess(res, data, 'Custom proposal sent', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async listProposals(req: Request, res: Response, next: NextFunction) {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const data = await cityPackageService.listProposals(status);
      sendSuccess(res, data, 'Custom proposals fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async employerOffer(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await cityPackageService.offerForEmployer(req.employer!);
      sendSuccess(res, data, 'City packages fetched successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const cityPackageController = new CityPackageController();
