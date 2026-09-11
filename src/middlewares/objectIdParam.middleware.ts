import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import { isObjectIdString } from '../utils/validation';

/**
 * Reject malformed MongoDB ObjectId path params before service queries.
 */
export function validateObjectIdParam(paramName = 'id') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    if (!isObjectIdString(value)) {
      next(
        new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, [
          { path: paramName, message: 'Invalid id format' },
        ]),
      );
      return;
    }
    next();
  };
}
