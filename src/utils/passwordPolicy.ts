import { HTTP_STATUS } from '../constants';
import { AppError } from './AppError';

/**
 * Registration / admin-create password policy (B25).
 * Login validators stay length-only so existing accounts are not locked out.
 */
export function assertPasswordPolicy(password: string, path = 'password'): void {
  if (password.length < 8) {
    throw new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, [
      { path, message: 'Password must be at least 8 characters' },
    ]);
  }
  if (password.length > 128) {
    throw new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, [
      { path, message: 'Password must be at most 128 characters' },
    ]);
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, [
      {
        path,
        message: 'Password must include at least one letter and one number',
      },
    ]);
  }
}

/** Zod-friendly refine helper (returns issue message or true). */
export function passwordPolicyMessage(password: string): string | true {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 128) return 'Password must be at most 128 characters';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include at least one letter and one number';
  }
  return true;
}
