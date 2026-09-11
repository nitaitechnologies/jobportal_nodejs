import { Response } from 'express';
import { ApiErrorResponse, ApiSuccessResponse } from '../types/api.types';

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Operation successful',
  statusCode = 200,
): Response {
  const body: ApiSuccessResponse<T> = {
    success: true,
    message,
    data,
  };
  return res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  message = 'Something went wrong',
  statusCode = 500,
  errors: unknown[] = [],
): Response {
  const body: ApiErrorResponse = {
    success: false,
    message,
    errors,
  };
  return res.status(statusCode).json(body);
}
