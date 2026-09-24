import { randomInt } from 'node:crypto';
import { env } from '../config/env';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';

interface ResetEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

/** In-memory password-reset OTP store. Replace with Redis + email/SMS later. */
const resetStore = new Map<string, ResetEntry>();

const MAX_ATTEMPTS = 5;

function resolveResetCode(): string {
  if (env.candidateOtpDummy) {
    return env.candidateOtpDummy;
  }
  return String(randomInt(100000, 1000000));
}

export class PasswordResetService {
  /** Issue (or refresh) a reset code for a namespaced key (`candidate:email:…`). */
  send(key: string): { expiresIn: number; dummy: boolean } {
    const code = resolveResetCode();
    const expiresIn = env.candidateOtpTtlSeconds;
    resetStore.set(key, {
      code,
      expiresAt: Date.now() + expiresIn * 1000,
      attempts: 0,
    });

    // Email/SMS provider hook goes here later. Dummy mode never sends.
    return {
      expiresIn,
      dummy: Boolean(env.candidateOtpDummy),
    };
  }

  /**
   * Validate reset OTP. Consumes the entry on success.
   * Throws AppError on invalid / expired / too many attempts.
   */
  verify(key: string, otp: string): void {
    const entry = resetStore.get(key);

    if (!entry) {
      throw new AppError(
        'Reset code not found or already used. Request a new code.',
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    if (Date.now() > entry.expiresAt) {
      resetStore.delete(key);
      throw new AppError('Reset code has expired. Request a new code.', HTTP_STATUS.BAD_REQUEST);
    }

    if (entry.attempts >= MAX_ATTEMPTS) {
      resetStore.delete(key);
      throw new AppError(
        'Too many invalid reset attempts. Request a new code.',
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    entry.attempts += 1;

    if (entry.code !== otp) {
      throw new AppError('Invalid reset code', HTTP_STATUS.UNAUTHORIZED);
    }

    resetStore.delete(key);
  }

  /** Test helper — clear in-memory store between suites. */
  clearAll(): void {
    resetStore.clear();
  }
}

export const passwordResetService = new PasswordResetService();
