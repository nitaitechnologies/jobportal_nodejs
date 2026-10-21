import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  q: z.string().trim().max(120).optional(),
  sort: z.enum(['latest', 'closingSoon']).default('latest'),
});

export function validateSarkariListQuery(req: Request, _res: Response, next: NextFunction): void {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(new AppError('Invalid query parameters', HTTP_STATUS.BAD_REQUEST, parsed.error.issues));
    return;
  }
  (req as Request & { validatedQuery: z.infer<typeof listQuerySchema> }).validatedQuery = parsed.data;
  next();
}

export function validateSarkariSlugParam(req: Request, _res: Response, next: NextFunction): void {
  const slug = typeof req.params.slug === 'string' ? req.params.slug.trim() : '';
  if (!slug || slug.length > 220) {
    next(new AppError('Invalid job slug', HTTP_STATUS.BAD_REQUEST));
    return;
  }
  next();
}
