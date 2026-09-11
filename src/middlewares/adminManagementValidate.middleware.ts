import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import {
  adminApplicationListQuerySchema,
  adminAuditListQuerySchema,
  adminCandidateListQuerySchema,
  adminCandidateStatusSchema,
  adminCandidateVisibilitySchema,
  adminCompanyListQuerySchema,
  adminCompanyStatusSchema,
  adminCompanyVerificationSchema,
  adminEmployerListQuerySchema,
  adminEmployerStatusSchema,
  adminIdParamSchema,
  adminInterviewListQuerySchema,
  adminJobFlagSchema,
  adminJobFeatureSchema,
  adminJobUrgentSchema,
  adminJobListQuerySchema,
  adminJobStatusSchema,
  adminUserCreateSchema,
  adminUserListQuerySchema,
  adminUserRoleSchema,
  adminUserStatusSchema,
  adminUserUpdateSchema,
  ADMIN_USER_CREATE_FORBIDDEN,
} from '../validators/adminManagement.validator';

function containsMongoOperators(value: unknown, path = 'body'): string | null {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const found = containsMongoOperators(value[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith('$')) {
        return path === 'body' || path === 'query' ? key : `${path}.${key}`;
      }
      const found = containsMongoOperators(
        nested,
        path === 'body' || path === 'query' ? key : `${path}.${key}`,
      );
      if (found) return found;
    }
  }
  return null;
}

function validateWithSchema<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  next: NextFunction,
  root: 'body' | 'query' | 'params',
): T | null {
  const operatorPath = containsMongoOperators(payload, root);
  if (operatorPath) {
    next(
      new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, [
        { path: operatorPath, message: 'MongoDB operators are not allowed' },
      ]),
    );
    return null;
  }

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

function rejectForbidden(body: unknown, forbidden: readonly string[], next: NextFunction): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return false;
  }
  for (const key of Object.keys(body as object)) {
    if (forbidden.includes(key)) {
      next(
        new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, [
          { path: key, message: 'Field is not allowed' },
        ]),
      );
      return false;
    }
  }
  return true;
}

function attachQuery<T>(req: Request, data: T): void {
  (req as Request & { validatedQuery?: T }).validatedQuery = data;
}

export function validateAdminIdParam(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(adminIdParamSchema, req.params, next, 'params');
  if (data) next();
}

function makeQueryValidator(schema: ZodSchema<unknown>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = validateWithSchema(schema, req.query, next, 'query');
    if (data) {
      attachQuery(req, data);
      next();
    }
  };
}

function makeBodyValidator(schema: ZodSchema<unknown>, forbidden: readonly string[] = []) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (forbidden.length && !rejectForbidden(req.body, forbidden, next)) return;
    const data = validateWithSchema(schema, req.body, next, 'body');
    if (data) {
      req.body = data;
      next();
    }
  };
}

export const validateAdminUserListQuery = makeQueryValidator(adminUserListQuerySchema);
export const validateAdminUserCreate = makeBodyValidator(
  adminUserCreateSchema,
  ADMIN_USER_CREATE_FORBIDDEN,
);
export const validateAdminUserUpdate = makeBodyValidator(adminUserUpdateSchema, [
  'passwordHash',
  'role',
  'permissions',
  'status',
  'userId',
]);
export const validateAdminUserStatus = makeBodyValidator(adminUserStatusSchema);
export const validateAdminUserRole = makeBodyValidator(adminUserRoleSchema);

export const validateAdminCandidateListQuery = makeQueryValidator(adminCandidateListQuerySchema);
export const validateAdminCandidateStatus = makeBodyValidator(adminCandidateStatusSchema);
export const validateAdminCandidateVisibility = makeBodyValidator(adminCandidateVisibilitySchema);

export const validateAdminEmployerListQuery = makeQueryValidator(adminEmployerListQuerySchema);
export const validateAdminEmployerStatus = makeBodyValidator(adminEmployerStatusSchema);

export const validateAdminCompanyListQuery = makeQueryValidator(adminCompanyListQuerySchema);
export const validateAdminCompanyStatus = makeBodyValidator(adminCompanyStatusSchema);
export const validateAdminCompanyVerification = makeBodyValidator(adminCompanyVerificationSchema);

export const validateAdminJobListQuery = makeQueryValidator(adminJobListQuerySchema);
export const validateAdminJobStatus = makeBodyValidator(adminJobStatusSchema);
export const validateAdminJobFeature = makeBodyValidator(adminJobFeatureSchema);
export const validateAdminJobUrgent = makeBodyValidator(adminJobUrgentSchema);
export const validateAdminJobFlags = makeBodyValidator(adminJobFlagSchema);

export const validateAdminApplicationListQuery = makeQueryValidator(adminApplicationListQuerySchema);
export const validateAdminInterviewListQuery = makeQueryValidator(adminInterviewListQuerySchema);
export const validateAdminAuditListQuery = makeQueryValidator(adminAuditListQuerySchema);
