import { NextFunction, Request, Response } from 'express';
import { aiResumeService } from '../services/aiResume.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants';
import type { AiResumeBuildInput, AiResumeTailorInput } from '../validators/aiResume.validator';

function requireCandidateContext(req: Request) {
  if (!req.candidate) {
    throw new AppError('Candidate access required', HTTP_STATUS.FORBIDDEN);
  }
  return req.candidate;
}

export class AiResumeController {
  async build(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await aiResumeService.build(
        requireCandidateContext(req),
        req.body as AiResumeBuildInput,
      );
      sendSuccess(
        res,
        data,
        'AI resume draft generated — review carefully before using',
      );
    } catch (error) {
      next(error);
    }
  }

  async tailor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await aiResumeService.tailor(
        requireCandidateContext(req),
        req.body as AiResumeTailorInput,
      );
      sendSuccess(
        res,
        data,
        'AI job-tailored resume draft generated — review carefully before using',
      );
    } catch (error) {
      next(error);
    }
  }
}

export const aiResumeController = new AiResumeController();
