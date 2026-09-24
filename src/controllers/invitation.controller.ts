import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { invitationService } from '../services/invitation.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  InvitationCreateInput,
  InvitationQuery,
} from '../validators/invitation.validator';

type RequestWithValidatedQuery = Request & {
  validatedQuery?: InvitationQuery;
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

export class InvitationController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await invitationService.create(
        requireEmployerContext(req),
        req.body as InvitationCreateInput,
      );
      sendSuccess(res, data, 'Invitation sent successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async listEmployer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as InvitationQuery;
      const data = await invitationService.listEmployer(requireEmployerContext(req), query);
      sendSuccess(res, data, 'Invitations fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async listCandidate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as InvitationQuery;
      const data = await invitationService.listCandidate(requireCandidateContext(req), query);
      sendSuccess(res, data, 'Invitations fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCandidateById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await invitationService.getCandidateById(requireCandidateContext(req), id);
      sendSuccess(res, data, 'Invitation fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await invitationService.cancel(requireEmployerContext(req), id);
      sendSuccess(res, data, 'Invitation cancelled successfully');
    } catch (error) {
      next(error);
    }
  }

  async accept(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await invitationService.accept(requireCandidateContext(req), id);
      sendSuccess(res, data, 'Invitation accepted successfully');
    } catch (error) {
      next(error);
    }
  }

  async decline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await invitationService.decline(requireCandidateContext(req), id);
      sendSuccess(res, data, 'Invitation declined successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const invitationController = new InvitationController();
