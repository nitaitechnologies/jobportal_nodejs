import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { aiCareerCoachService } from '../services/aiCareerCoach.service';
import { aiMatchingService } from '../services/aiMatching.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type { AiMatchListQuery } from '../validators/aiMatching.validator';

type RequestWithValidatedQuery = Request & { validatedQuery?: AiMatchListQuery };

function requireCandidateContext(req: Request) {
  if (!req.candidate) {
    throw new AppError('Candidate access required', HTTP_STATUS.FORBIDDEN);
  }
  return req.candidate;
}

export class AiMatchingController {
  async listMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as AiMatchListQuery;
      const data = await aiMatchingService.listMatches(requireCandidateContext(req), {
        limit: query.limit,
        minScore: query.minScore,
        withAiInsights: query.withAiInsights,
      });
      sendSuccess(res, data, 'Job matches fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async explainMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobId = typeof req.params.jobId === 'string' ? req.params.jobId : '';
      const data = await aiMatchingService.explainMatch(requireCandidateContext(req), jobId);
      sendSuccess(res, data, 'AI match explanation generated — review carefully');
    } catch (error) {
      next(error);
    }
  }

  async careerCoach(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await aiCareerCoachService.getCoach(requireCandidateContext(req));
      sendSuccess(res, data, 'AI career coach ready — guidance only');
    } catch (error) {
      next(error);
    }
  }
}

export const aiMatchingController = new AiMatchingController();
