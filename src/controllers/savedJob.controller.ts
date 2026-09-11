import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { savedJobService } from '../services/savedJob.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type { SavedJobListQuery } from '../validators/savedJob.validator';

type RequestWithValidatedQuery = Request & {
  validatedQuery?: SavedJobListQuery;
};

function requireCandidateContext(req: Request) {
  if (!req.candidate) {
    throw new AppError('Candidate access required', HTTP_STATUS.FORBIDDEN);
  }
  return req.candidate;
}

export class SavedJobController {
  async save(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobId = typeof req.params.jobId === 'string' ? req.params.jobId : '';
      const data = await savedJobService.save(requireCandidateContext(req), jobId);
      const message = data.alreadySaved ? 'Job already saved' : 'Job saved successfully';
      const status = data.alreadySaved ? HTTP_STATUS.OK : HTTP_STATUS.CREATED;
      sendSuccess(res, data, message, status);
    } catch (error) {
      next(error);
    }
  }

  async unsave(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobId = typeof req.params.jobId === 'string' ? req.params.jobId : '';
      const data = await savedJobService.unsave(requireCandidateContext(req), jobId);
      sendSuccess(res, data, 'Job removed from saved jobs');
    } catch (error) {
      next(error);
    }
  }

  async toggle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobId = typeof req.params.jobId === 'string' ? req.params.jobId : '';
      const data = await savedJobService.toggle(requireCandidateContext(req), jobId);
      const message = data.saved
        ? 'Job saved successfully'
        : 'Job removed from saved jobs';
      sendSuccess(res, data, message);
    } catch (error) {
      next(error);
    }
  }

  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobId = typeof req.params.jobId === 'string' ? req.params.jobId : '';
      const data = await savedJobService.getStatus(requireCandidateContext(req), jobId);
      sendSuccess(res, data, 'Saved job status fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as SavedJobListQuery;
      const data = await savedJobService.list(requireCandidateContext(req), query);
      sendSuccess(res, data, 'Saved jobs fetched successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const savedJobController = new SavedJobController();
