import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { parseRequestSchema } from '../utils/validation';
import {
  aiResumeBuildSchema,
  aiResumeTailorSchema,
} from '../validators/aiResume.validator';

function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = parseRequestSchema(schema, req.body, next, 'body');
    if (!data) {
      return;
    }
    req.body = data;
    next();
  };
}

export const validateAiResumeBuild = validateBody(aiResumeBuildSchema);
export const validateAiResumeTailor = validateBody(aiResumeTailorSchema);
