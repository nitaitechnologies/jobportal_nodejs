import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import {
  invoiceIdParamSchema,
  invoiceQuerySchema,
  paymentCheckoutSchema,
  paymentConfirmSchema,
  paymentFailSchema,
  paymentIdParamSchema,
  paymentQuerySchema,
  paymentRefundSchema,
  paymentRevenueQuerySchema,
  walletTxnQuerySchema,
} from '../validators/payment.validator';

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
        return path === 'body' ? key : `${path}.${key}`;
      }
      const found = containsMongoOperators(nested, path === 'body' ? key : `${path}.${key}`);
      if (found) return found;
    }
  }
  return null;
}

function validateWithSchema<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  next: NextFunction,
  root = 'body',
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

export function validatePaymentCheckout(req: Request, _res: Response, next: NextFunction): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }
  const data = validateWithSchema(paymentCheckoutSchema, req.body, next);
  if (!data) return;
  req.body = data;
  next();
}

export function validatePaymentConfirm(req: Request, _res: Response, next: NextFunction): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }
  const data = validateWithSchema(paymentConfirmSchema, req.body, next);
  if (!data) return;
  req.body = data;
  next();
}

export function validatePaymentFail(req: Request, _res: Response, next: NextFunction): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }
  const data = validateWithSchema(paymentFailSchema, req.body, next);
  if (!data) return;
  req.body = data;
  next();
}

export function validatePaymentRefund(req: Request, _res: Response, next: NextFunction): void {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new AppError('Invalid request body', HTTP_STATUS.BAD_REQUEST));
    return;
  }
  const data = validateWithSchema(paymentRefundSchema, req.body, next);
  if (!data) return;
  req.body = data;
  next();
}

export function validatePaymentQuery(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(paymentQuerySchema, req.query, next, 'query');
  if (!data) return;
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validatePaymentRevenueQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const data = validateWithSchema(paymentRevenueQuerySchema, req.query, next, 'query');
  if (!data) return;
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validatePaymentIdParam(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(paymentIdParamSchema, req.params, next, 'params');
  if (!data) return;
  req.params.id = data.id;
  next();
}

export function validateWalletTxnQuery(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(walletTxnQuerySchema, req.query, next, 'query');
  if (!data) return;
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validateInvoiceQuery(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(invoiceQuerySchema, req.query, next, 'query');
  if (!data) return;
  (req as Request & { validatedQuery?: unknown }).validatedQuery = data;
  next();
}

export function validateInvoiceIdParam(req: Request, _res: Response, next: NextFunction): void {
  const data = validateWithSchema(invoiceIdParamSchema, req.params, next, 'params');
  if (!data) return;
  req.params.id = data.id;
  next();
}
