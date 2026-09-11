import type { NextFunction } from 'express';
import { z, type ZodSchema } from 'zod';
import { HTTP_STATUS } from '../constants';
import { AppError } from './AppError';

/** Strict 24-char hex ObjectId (rejects CastError-prone values). */
export const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

export function isObjectIdString(value: unknown): value is string {
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);
}

/**
 * Detect MongoDB operator keys ($ne, $gt, …) in client payloads.
 * Returns the first offending path or null.
 */
export function containsMongoOperators(value: unknown, path = 'body'): string | null {
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
        return path === 'body' || path === 'query' || path === 'params' ? key : `${path}.${key}`;
      }
      const found = containsMongoOperators(
        nested,
        path === 'body' || path === 'query' || path === 'params' ? key : `${path}.${key}`,
      );
      if (found) return found;
    }
  }
  return null;
}

/**
 * Shared Zod parse for request payloads — rejects Mongo operator keys first.
 */
export function parseRequestSchema<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  next: NextFunction,
  root: 'body' | 'query' | 'params' = 'body',
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

/** Escape user text before embedding in RegExp. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * HTTP(S) URL only — rejects javascript:, data:, vbscript:, etc.
 * Empty string allowed when optional fields send "".
 */
export function isSafeHttpUrl(value: string, options?: { httpsOnly?: boolean }): boolean {
  if (value === '') return true;
  try {
    const parsed = new URL(value);
    if (options?.httpsOnly) {
      return parsed.protocol === 'https:';
    }
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const httpUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => isSafeHttpUrl(value), {
    message: 'URL must use http or https',
  });

export const httpsUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => isSafeHttpUrl(value, { httpsOnly: true }), {
    message: 'URL must use https',
  });

/** Soft cap for admin in-memory join scans (DoS guard). */
export const ADMIN_LIST_SCAN_CAP = 5000;
