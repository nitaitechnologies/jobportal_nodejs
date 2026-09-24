import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { companyVerificationService } from '../services/companyVerification.service';
import { mediaUploadService } from '../services/mediaUpload.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import { requireUploadedFile } from '../middlewares/upload.middleware';
import type {
  CompanyDocumentType,
  CompanyVerificationDetailsInput,
} from '../validators/companyVerification.validator';
import '../types/express';

function requireEmployer(req: Request) {
  if (!req.employer) {
    throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
  }
  return req.employer;
}

export class CompanyVerificationController {
  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await companyVerificationService.getStatus(requireEmployer(req));
      sendSuccess(res, data, 'Company verification status fetched');
    } catch (error) {
      next(error);
    }
  }

  async updateDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await companyVerificationService.updateDetails(
        requireEmployer(req),
        req.body as CompanyVerificationDetailsInput,
      );
      sendSuccess(res, data, 'Company verification details saved');
    } catch (error) {
      next(error);
    }
  }

  async uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const type = (req.body as { type?: CompanyDocumentType }).type;
      if (!type) {
        throw new AppError('Document type is required', HTTP_STATUS.BAD_REQUEST);
      }
      const data = await mediaUploadService.uploadCompanyVerificationDocument(
        requireEmployer(req),
        requireUploadedFile(req),
        type,
      );
      sendSuccess(res, data, 'Company verification document uploaded');
    } catch (error) {
      next(error);
    }
  }
}

export const companyVerificationController = new CompanyVerificationController();
