import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { applicationService } from '../services/application.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  ApplicationApplyInput,
  ApplicationStatusUpdateInput,
  CandidateApplicationQuery,
  EmployerApplicationQuery,
} from '../validators/application.validator';

type RequestWithValidatedQuery = Request & {
  validatedQuery?: CandidateApplicationQuery | EmployerApplicationQuery;
};

function requireCandidateContext(req: Request) {
  if (!req.candidate) {
    throw new AppError('Candidate access required', HTTP_STATUS.FORBIDDEN);
  }
  return req.candidate;
}

function requireEmployerContext(req: Request) {
  if (!req.employer) {
    throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
  }
  return req.employer;
}

export class ApplicationController {
  async apply(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobId = typeof req.params.jobId === 'string' ? req.params.jobId : '';
      const data = await applicationService.apply(
        requireCandidateContext(req),
        jobId,
        req.body as ApplicationApplyInput,
      );
      sendSuccess(res, data, 'Application submitted successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async listCandidate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as CandidateApplicationQuery;
      const data = await applicationService.listCandidate(requireCandidateContext(req), query);
      sendSuccess(res, data, 'Applications fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCandidateById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await applicationService.getCandidateById(requireCandidateContext(req), id);
      sendSuccess(res, data, 'Application fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async withdraw(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await applicationService.withdraw(requireCandidateContext(req), id);
      sendSuccess(res, data, 'Application withdrawn successfully');
    } catch (error) {
      next(error);
    }
  }

  async listEmployer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as EmployerApplicationQuery;
      const data = await applicationService.listEmployer(requireEmployerContext(req), query);
      sendSuccess(res, data, 'Applications fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getEmployerById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await applicationService.getEmployerById(requireEmployerContext(req), id);
      sendSuccess(res, data, 'Application fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await applicationService.updateStatus(
        requireEmployerContext(req),
        id,
        req.body as ApplicationStatusUpdateInput,
      );
      sendSuccess(res, data, 'Application status updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const applicationController = new ApplicationController();
