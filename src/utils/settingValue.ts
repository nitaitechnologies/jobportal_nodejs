import { HTTP_STATUS } from '../constants';
import type { SettingValueType } from '../constants/enums';
import { AppError } from './AppError';

export function normalizeSettingKey(raw: string): string {
  const key = raw.trim();
  if (!key) {
    throw new AppError('Setting key is required', HTTP_STATUS.BAD_REQUEST);
  }
  if (key.length > 120) {
    throw new AppError('Setting key is too long', HTTP_STATUS.BAD_REQUEST);
  }
  if (key.includes('$') || key.includes(' ') || key.includes('..')) {
    throw new AppError('Invalid setting key', HTTP_STATUS.BAD_REQUEST);
  }
  // Preserve camelCase (e.g. jobs.defaultPageSize). Only ASCII letters/digits/._-
  if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(key)) {
    throw new AppError(
      'Setting key must start with a letter and use only letters, digits, ".", "_", "-"',
      HTTP_STATUS.BAD_REQUEST,
      [{ path: 'key', message: 'Invalid key format' }],
    );
  }
  return key;
}

export function coerceSettingValue(
  type: SettingValueType,
  value: unknown,
): unknown {
  switch (type) {
    case 'string': {
      if (typeof value !== 'string') {
        throw new AppError('Value must be a string', HTTP_STATUS.BAD_REQUEST, [
          { path: 'value', message: 'Expected string' },
        ]);
      }
      return value;
    }
    case 'number': {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
        const n = Number(value);
        if (!Number.isFinite(n)) {
          throw new AppError('Value must be a finite number', HTTP_STATUS.BAD_REQUEST);
        }
        return n;
      }
      throw new AppError('Value must be a number', HTTP_STATUS.BAD_REQUEST, [
        { path: 'value', message: 'Expected number' },
      ]);
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      throw new AppError('Value must be a boolean', HTTP_STATUS.BAD_REQUEST, [
        { path: 'value', message: 'Expected true or false' },
      ]);
    }
    case 'json': {
      if (value === null || typeof value === 'object') {
        // Reject arrays? Spec allows json - objects and arrays OK
        if (typeof value === 'object') {
          // Prevent prototype pollution at storage boundary
          if (Object.prototype.hasOwnProperty.call(value as object, '__proto__')) {
            throw new AppError('Invalid JSON value', HTTP_STATUS.BAD_REQUEST);
          }
          return value;
        }
      }
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (parsed !== null && typeof parsed === 'object') {
            return parsed;
          }
          throw new Error('not object');
        } catch {
          throw new AppError('Value must be valid JSON object/array', HTTP_STATUS.BAD_REQUEST, [
            { path: 'value', message: 'Invalid JSON' },
          ]);
        }
      }
      throw new AppError('Value must be a JSON object or array', HTTP_STATUS.BAD_REQUEST);
    }
    default:
      throw new AppError('Unsupported setting type', HTTP_STATUS.BAD_REQUEST);
  }
}

export function castStoredValue(type: SettingValueType, value: unknown): unknown {
  try {
    return coerceSettingValue(type, value);
  } catch {
    return value;
  }
}
