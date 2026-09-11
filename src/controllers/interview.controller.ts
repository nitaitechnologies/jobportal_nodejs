import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { interviewService } from '../services/interview.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  CandidateInterviewQuery,
  EmployerInterviewQuery,
  InterviewCancelInput,
  InterviewCreateInput,
  InterviewDeclineInput,
  InterviewRescheduleInput,
  InterviewUpdateInput,
} from '../validators/interview.validator';

type RequestWithValidatedQuery = Request & {
  validatedQuery?: CandidateInterviewQuery | EmployerInterviewQuery;
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

export class InterviewController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await interviewService.create(
        requireEmployerContext(req),
        req.body as InterviewCreateInput,
      );
      sendSuccess(res, data, 'Interview scheduled successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async listEmployer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as EmployerInterviewQuery;
      const data = await interviewService.listEmployer(requireEmployerContext(req), query);
      sendSuccess(res, data, 'Interviews fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getEmployerById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await interviewService.getEmployerById(requireEmployerContext(req), id);
      sendSuccess(res, data, 'Interview fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await interviewService.update(
        requireEmployerContext(req),
        id,
        req.body as InterviewUpdateInput,
      );
      sendSuccess(res, data, 'Interview updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async reschedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await interviewService.reschedule(
        requireEmployerContext(req),
        id,
        req.body as InterviewRescheduleInput,
      );
      sendSuccess(res, data, 'Interview rescheduled successfully');
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await interviewService.cancel(
        requireEmployerContext(req),
        id,
        req.body as InterviewCancelInput,
      );
      sendSuccess(res, data, 'Interview cancelled successfully');
    } catch (error) {
      next(error);
    }
  }

  async complete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await interviewService.complete(requireEmployerContext(req), id);
      sendSuccess(res, data, 'Interview marked as completed');
    } catch (error) {
      next(error);
    }
  }

  async listCandidate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as CandidateInterviewQuery;
      const data = await interviewService.listCandidate(requireCandidateContext(req), query);
      sendSuccess(res, data, 'Interviews fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCandidateById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await interviewService.getCandidateById(requireCandidateContext(req), id);
      sendSuccess(res, data, 'Interview fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async confirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await interviewService.confirm(requireCandidateContext(req), id);
      sendSuccess(res, data, 'Interview confirmed successfully');
    } catch (error) {
      next(error);
    }
  }

  async decline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await interviewService.decline(
        requireCandidateContext(req),
        id,
        req.body as InterviewDeclineInput,
      );
      sendSuccess(res, data, 'Interview declined successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const interviewController = new InterviewController();
