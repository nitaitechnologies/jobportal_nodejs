import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { HTTP_STATUS } from '../constants';
import { MEDIA_MAX_BYTES, type MediaCategory } from '../constants/media';
import { AppError } from '../utils/AppError';

const memory = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fields: 5,
    // Absolute ceiling; per-category limits enforced in media.service.
    fileSize: 5 * 1024 * 1024,
  },
});

function mapMulterError(error: unknown): AppError {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return new AppError('File too large', HTTP_STATUS.BAD_REQUEST, [
        { path: 'file', message: 'Upload exceeds maximum allowed size' },
      ]);
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return new AppError('Unexpected upload field', HTTP_STATUS.BAD_REQUEST, [
        { path: 'file', message: 'Use field name "file"' },
      ]);
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return new AppError('Too many files', HTTP_STATUS.BAD_REQUEST);
    }
    return new AppError('Malformed upload', HTTP_STATUS.BAD_REQUEST, [
      { path: 'file', message: error.message },
    ]);
  }
  if (error instanceof Error) {
    return new AppError('File upload failed', HTTP_STATUS.BAD_REQUEST, [
      { path: 'file', message: error.message },
    ]);
  }
  return new AppError('File upload failed', HTTP_STATUS.BAD_REQUEST);
}

/**
 * Accept a single multipart field named `file`.
 * Category-specific size limits are applied after multer in the service.
 */
export function uploadSingle(fieldName = 'file') {
  return (req: Request, res: Response, next: NextFunction): void => {
    memory.single(fieldName)(req, res, (error: unknown) => {
      if (error) {
        next(mapMulterError(error));
        return;
      }
      if (!req.file) {
        next(
          new AppError('File is required', HTTP_STATUS.BAD_REQUEST, [
            { path: 'file', message: 'Multipart field "file" is required' },
          ]),
        );
        return;
      }
      next();
    });
  };
}

export function requireUploadedFile(req: Request): Express.Multer.File {
  if (!req.file) {
    throw new AppError('File is required', HTTP_STATUS.BAD_REQUEST);
  }
  return req.file;
}

export function categoryMaxBytes(category: MediaCategory): number {
  return MEDIA_MAX_BYTES[category];
}
