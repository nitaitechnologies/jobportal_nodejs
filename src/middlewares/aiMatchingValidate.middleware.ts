import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { parseRequestSchema } from '../utils/validation';
import {
  aiMatchJobIdParamSchema,
  aiMatchListQuerySchema,
} from '../validators/aiMatching.validator';

function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = parseRequestSchema(schema, req.query, next, 'query');
    if (!data) return;
    (req as Request & { validatedQuery?: T }).validatedQuery = data;
    next();
  };
}

function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = parseRequestSchema(schema, req.params, next, 'params');
    if (!data) return;
    req.params = data as unknown as typeof req.params;
    next();
  };
}

export const validateAiMatchListQuery = validateQuery(aiMatchListQuerySchema);
export const validateAiMatchJobIdParam = validateParams(aiMatchJobIdParamSchema);
