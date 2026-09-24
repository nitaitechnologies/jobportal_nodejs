import { NextFunction, Request, Response } from 'express';
import { employerAiRecruitmentService } from '../services/employerAiRecruitment.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants';
import type {
  GenerateInterviewQuestionsInput,
  GenerateMessageInput,
  ImproveJdInput,
  SaveInterviewQuestionsInput,
  ScreenCandidatesInput,
  SuggestCandidatesInput,
  SuggestSkillsInput,
  SummarizeProfileInput,
} from '../validators/employerAiRecruitment.validator';

function requireEmployerContext(req: Request) {
  if (!req.employer) {
    throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
  }
  return req.employer;
}

export class EmployerAiRecruitmentController {
  async improveJd(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await employerAiRecruitmentService.improveJd(
        requireEmployerContext(req),
        req.body as ImproveJdInput,
      );
      sendSuccess(res, data, 'AI job description draft ready — review before publishing');
    } catch (error) {
      next(error);
    }
  }

  async suggestSkills(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await employerAiRecruitmentService.suggestSkills(
        requireEmployerContext(req),
        req.body as SuggestSkillsInput,
      );
      sendSuccess(res, data, 'AI skill suggestions ready');
    } catch (error) {
      next(error);
    }
  }

  async screenCandidates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await employerAiRecruitmentService.screenCandidates(
        requireEmployerContext(req),
        req.body as ScreenCandidatesInput,
      );
      sendSuccess(res, data, 'AI candidate screening complete');
    } catch (error) {
      next(error);
    }
  }

  async summarizeProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await employerAiRecruitmentService.summarizeProfile(
        requireEmployerContext(req),
        req.body as SummarizeProfileInput,
      );
      sendSuccess(res, data, 'AI profile summary ready');
    } catch (error) {
      next(error);
    }
  }

  async suggestCandidates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await employerAiRecruitmentService.suggestCandidates(
        requireEmployerContext(req),
        req.body as SuggestCandidatesInput,
      );
      sendSuccess(res, data, 'AI candidate suggestions ready');
    } catch (error) {
      next(error);
    }
  }

  async generateInterviewQuestions(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const data = await employerAiRecruitmentService.generateInterviewQuestions(
        requireEmployerContext(req),
        req.body as GenerateInterviewQuestionsInput,
      );
      sendSuccess(res, data, 'AI interview questions ready — review before saving');
    } catch (error) {
      next(error);
    }
  }

  async saveInterviewQuestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await employerAiRecruitmentService.saveInterviewQuestions(
        requireEmployerContext(req),
        req.body as SaveInterviewQuestionsInput,
      );
      sendSuccess(res, data, 'AI interview questions saved on job');
    } catch (error) {
      next(error);
    }
  }

  async getSavedInterviewQuestions(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const jobId = String(req.params.jobId ?? '');
      const data = await employerAiRecruitmentService.getSavedInterviewQuestions(
        requireEmployerContext(req),
        jobId,
      );
      sendSuccess(res, data, 'Saved AI interview questions');
    } catch (error) {
      next(error);
    }
  }

  async generateSelectionMessage(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const data = await employerAiRecruitmentService.generateSelectionMessage(
        requireEmployerContext(req),
        req.body as GenerateMessageInput,
      );
      sendSuccess(res, data, 'AI selection message ready — edit before sending');
    } catch (error) {
      next(error);
    }
  }

  async generateRejectionMessage(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const data = await employerAiRecruitmentService.generateRejectionMessage(
        requireEmployerContext(req),
        req.body as GenerateMessageInput,
      );
      sendSuccess(res, data, 'AI rejection message ready — edit before sending');
    } catch (error) {
      next(error);
    }
  }
}

export const employerAiRecruitmentController = new EmployerAiRecruitmentController();
