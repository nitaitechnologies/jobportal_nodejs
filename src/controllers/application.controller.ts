import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { applicationService } from '../services/application.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  ApplicationApplyInput,
  ApplicationBulkMessageInput,
  ApplicationBulkStatusInput,
  ApplicationInternalRatingInput,
  ApplicationNotesUpdateInput,
  ApplicationStatusUpdateInput,
  CandidateApplicationQuery,
  EmployerApplicationExportQuery,
  EmployerApplicationQuery,
  EmployerApplicationStatsQuery,
} from '../validators/application.validator';

type RequestWithValidatedQuery = Request & {
  validatedQuery?:
    | CandidateApplicationQuery
    | EmployerApplicationQuery
    | EmployerApplicationStatsQuery
    | EmployerApplicationExportQuery;
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

  async getEmployerStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery)
        .validatedQuery as EmployerApplicationStatsQuery;
      const data = await applicationService.getEmployerStats(requireEmployerContext(req), query);
      sendSuccess(res, data, 'Application stats fetched successfully');
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

  async bulkUpdateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await applicationService.bulkUpdateStatus(
        requireEmployerContext(req),
        req.body as ApplicationBulkStatusInput,
      );
      sendSuccess(res, data, 'Bulk application status update completed');
    } catch (error) {
      next(error);
    }
  }

  async bulkMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await applicationService.bulkMessage(
        requireEmployerContext(req),
        req.body as ApplicationBulkMessageInput,
      );
      sendSuccess(res, data, 'Bulk message completed');
    } catch (error) {
      next(error);
    }
  }

  async exportEmployerCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery)
        .validatedQuery as EmployerApplicationExportQuery;
      const data = await applicationService.exportEmployerCsv(
        requireEmployerContext(req),
        query,
      );
      res.setHeader('Content-Type', data.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${data.filename}"`);
      res.status(200).send(data.csv);
    } catch (error) {
      next(error);
    }
  }

  async addNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await applicationService.addNote(
        requireEmployerContext(req),
        id,
        req.body as ApplicationNotesUpdateInput,
      );
      sendSuccess(res, data, 'Note added successfully');
    } catch (error) {
      next(error);
    }
  }

  async setInternalRating(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await applicationService.setInternalRating(
        requireEmployerContext(req),
        id,
        req.body as ApplicationInternalRatingInput,
      );
      sendSuccess(res, data, 'Internal rating updated');
    } catch (error) {
      next(error);
    }
  }

  async updateNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const noteId = typeof req.params.noteId === 'string' ? req.params.noteId : '';
      const data = await applicationService.updateNote(
        requireEmployerContext(req),
        id,
        noteId,
        req.body as ApplicationNotesUpdateInput,
      );
      sendSuccess(res, data, 'Note updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const noteId = typeof req.params.noteId === 'string' ? req.params.noteId : '';
      const data = await applicationService.deleteNote(requireEmployerContext(req), id, noteId);
      sendSuccess(res, data, 'Note deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const applicationController = new ApplicationController();
