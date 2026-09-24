import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import {
  taxonomyCreateSchema,
  taxonomyIdParamSchema,
  taxonomyQuerySchema,
  taxonomyUpdateSchema,
} from '../validators/taxonomy.validator';
import {
  bannerCreateSchema,
  bannerIdParamSchema,
  bannerQuerySchema,
  bannerUpdateSchema,
} from '../validators/contentBanner.validator';
import {
  faqCreateSchema,
  faqIdParamSchema,
  faqQuerySchema,
  faqUpdateSchema,
} from '../validators/faq.validator';
import {
  adminNotificationQuerySchema,
  adminNotificationSendSchema,
  notificationTemplateCreateSchema,
  notificationTemplateIdParamSchema,
  notificationTemplateQuerySchema,
  notificationTemplateUpdateSchema,
} from '../validators/adminNotification.validator';

function validateWithSchema<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  next: NextFunction,
  root: 'body' | 'query' | 'params',
): T | null {
  const result = schema.safeParse(payload);
  if (!result.success) {
    next(
      new AppError(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        result.error.issues.map((issue) => ({
          path: issue.path.join('.') || root,
          message: issue.message,
        })),
      ),
    );
    return null;
  }
  return result.data;
}

function makeQueryValidator(schema: ZodSchema<unknown>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = validateWithSchema(schema, req.query, next, 'query');
    if (data) {
      (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
      next();
    }
  };
}

function makeBodyValidator(schema: ZodSchema<unknown>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = validateWithSchema(schema, req.body, next, 'body');
    if (data) {
      req.body = data;
      next();
    }
  };
}

function makeParamValidator(schema: ZodSchema<{ id: string }>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = validateWithSchema(schema, req.params, next, 'params');
    if (data) {
      req.params.id = data.id;
      next();
    }
  };
}

export const validateTaxonomyQuery = makeQueryValidator(taxonomyQuerySchema);
export const validateTaxonomyCreate = makeBodyValidator(taxonomyCreateSchema);
export const validateTaxonomyUpdate = makeBodyValidator(taxonomyUpdateSchema);
export const validateTaxonomyIdParam = makeParamValidator(taxonomyIdParamSchema);

export const validateBannerQuery = makeQueryValidator(bannerQuerySchema);
export const validateBannerCreate = makeBodyValidator(bannerCreateSchema);
export const validateBannerUpdate = makeBodyValidator(bannerUpdateSchema);
export const validateBannerIdParam = makeParamValidator(bannerIdParamSchema);

export const validateFaqQuery = makeQueryValidator(faqQuerySchema);
export const validateFaqCreate = makeBodyValidator(faqCreateSchema);
export const validateFaqUpdate = makeBodyValidator(faqUpdateSchema);
export const validateFaqIdParam = makeParamValidator(faqIdParamSchema);

export const validateAdminNotificationQuery = makeQueryValidator(adminNotificationQuerySchema);
export const validateAdminNotificationSend = makeBodyValidator(adminNotificationSendSchema);
export const validateNotificationTemplateQuery = makeQueryValidator(notificationTemplateQuerySchema);
export const validateNotificationTemplateCreate = makeBodyValidator(notificationTemplateCreateSchema);
export const validateNotificationTemplateUpdate = makeBodyValidator(notificationTemplateUpdateSchema);
export const validateNotificationTemplateIdParam = makeParamValidator(
  notificationTemplateIdParamSchema,
);
