import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { parseRequestSchema } from '../utils/validation';
import {
  generateInterviewQuestionsSchema,
  generateMessageSchema,
  improveJdSchema,
  saveInterviewQuestionsSchema,
  screenCandidatesSchema,
  suggestCandidatesSchema,
  suggestSkillsSchema,
  summarizeProfileSchema,
} from '../validators/employerAiRecruitment.validator';

function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = parseRequestSchema(schema, req.body, next, 'body');
    if (!data) return;
    req.body = data;
    next();
  };
}

export const validateImproveJd = validateBody(improveJdSchema);
export const validateSuggestSkills = validateBody(suggestSkillsSchema);
export const validateScreenCandidates = validateBody(screenCandidatesSchema);
export const validateSummarizeProfile = validateBody(summarizeProfileSchema);
export const validateSuggestCandidates = validateBody(suggestCandidatesSchema);
export const validateGenerateInterviewQuestions = validateBody(generateInterviewQuestionsSchema);
export const validateSaveInterviewQuestions = validateBody(saveInterviewQuestionsSchema);
export const validateGenerateMessage = validateBody(generateMessageSchema);
