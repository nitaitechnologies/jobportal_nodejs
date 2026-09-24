import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { candidateSafetyService } from '../services/candidateSafety.service';
import { candidateVerificationService } from '../services/candidateVerification.service';
import type { AuthenticatedCandidate } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  BlockEmployerInput,
  CandidateDocumentSubmitInput,
} from '../validators/candidateSafety.validator';
import '../types/express';

function requireCandidate(req: Request): AuthenticatedCandidate {
  if (!req.candidate) {
    throw new AppError('Candidate context required', HTTP_STATUS.UNAUTHORIZED);
  }
  return req.candidate;
}

export class CandidateSafetyController {
  async blockEmployer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await candidateSafetyService.blockEmployer(
        requireCandidate(req),
        req.body as BlockEmployerInput,
      );
      sendSuccess(res, data, 'Employer blocked successfully');
    } catch (error) {
      next(error);
    }
  }

  async unblockEmployer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await candidateSafetyService.unblockEmployer(
        requireCandidate(req),
        req.body as BlockEmployerInput,
      );
      sendSuccess(res, data, 'Employer unblocked successfully');
    } catch (error) {
      next(error);
    }
  }

  async listBlocked(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await candidateSafetyService.listBlockedEmployers(requireCandidate(req));
      sendSuccess(res, data, 'Blocked employers fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async submitDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await candidateVerificationService.submitDocument(
        requireCandidate(req),
        req.body as CandidateDocumentSubmitInput,
      );
      sendSuccess(res, data, 'Document submitted for verification', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async getVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await candidateVerificationService.getStatus(requireCandidate(req));
      sendSuccess(res, data, 'Verification status fetched successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const candidateSafetyController = new CandidateSafetyController();
