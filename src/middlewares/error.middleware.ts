import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import { sendError } from '../utils/apiResponse';

function isMongoCastError(err: unknown): boolean {
  return (
    err instanceof mongoose.Error.CastError ||
    (typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      (err as { name?: string }).name === 'CastError')
  );
}

function isMongoValidationError(err: unknown): boolean {
  return err instanceof mongoose.Error.ValidationError;
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: number }).code === 11000
  );
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.errors);
    return;
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : 'Malformed upload';
    sendError(res, message, HTTP_STATUS.BAD_REQUEST, [
      { path: 'file', message: 'Upload rejected' },
    ]);
    return;
  }

  if (isMongoCastError(err)) {
    sendError(res, 'Invalid identifier', HTTP_STATUS.BAD_REQUEST, [
      { path: 'id', message: 'Invalid id format' },
    ]);
    return;
  }

  if (isMongoValidationError(err)) {
    sendError(res, 'Validation failed', HTTP_STATUS.BAD_REQUEST, [
      { path: 'body', message: 'Document validation failed' },
    ]);
    return;
  }

  if (isDuplicateKeyError(err)) {
    sendError(res, 'Resource already exists', HTTP_STATUS.CONFLICT);
    return;
  }

  // Never leak stack traces, paths, connection strings, or secrets in production.
  const message = env.isProduction
    ? 'Something went wrong'
    : err.message || 'Something went wrong';

  const errors = env.isProduction
    ? []
    : [{ name: err.name, message: err.message }];

  sendError(res, message, HTTP_STATUS.INTERNAL_SERVER_ERROR, errors);
}
