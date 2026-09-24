import { randomInt } from 'node:crypto';
import { env } from '../config/env';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import { sendEmail } from './email.service';

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

/** In-memory OTP store. Replace with Redis when multi-instance. */
const otpStore = new Map<string, OtpEntry>();

const MAX_ATTEMPTS = 5;

function resolveOtpCode(): string {
  if (env.candidateOtpDummy) {
    return env.candidateOtpDummy;
  }
  return String(randomInt(100000, 1000000));
}

export type OtpChannel = 'sms' | 'email' | 'auto';

export type OtpSendOptions = {
  /** Destination phone (E.164-ish) or email when channel is email. */
  destination?: string;
  channel?: OtpChannel;
  purpose?: string;
};

/**
 * OTP service (sheet 474).
 * Dummy mode issues fixed code and still records a delivery attempt for auditability.
 */
export class OtpService {
  /**
   * Issue (or refresh) an OTP for a store key (phone or prefixed channel key).
   */
  send(key: string, options: OtpSendOptions = {}): {
    expiresIn: number;
    dummy: boolean;
    channel: 'sms' | 'email' | 'none';
  } {
    const code = resolveOtpCode();
    const expiresIn = env.candidateOtpTtlSeconds;
    otpStore.set(key, {
      code,
      expiresAt: Date.now() + expiresIn * 1000,
      attempts: 0,
    });

    const destination = (options.destination ?? key).trim();
    const wantsEmail =
      options.channel === 'email' ||
      (options.channel !== 'sms' && destination.includes('@'));

    if (env.candidateOtpDummy) {
      console.info(
        `[otp:dummy] key=${key} channel=${wantsEmail ? 'email' : 'sms'} purpose=${options.purpose ?? 'verify'}`,
      );
      return { expiresIn, dummy: true, channel: wantsEmail ? 'email' : 'sms' };
    }

    if (wantsEmail) {
      void sendEmail({
        to: destination,
        subject: 'Your verification code',
        text: `Your OTP is ${code}. It expires in ${expiresIn} seconds.`,
        html: `<p>Your OTP is <strong>${code}</strong>.</p><p>It expires in ${expiresIn} seconds.</p>`,
      });
      return { expiresIn, dummy: false, channel: 'email' };
    }

    // SMS provider hook — log until Twilio/MSG91 is configured.
    const smsKey = (process.env.SMS_PROVIDER_API_KEY ?? '').trim();
    if (smsKey) {
      console.info(`[otp:sms] queued to=${destination} provider=configured`);
    } else {
      console.info(`[otp:sms:log] to=${destination} code=${code} (set SMS_PROVIDER_API_KEY for live SMS)`);
    }
    return { expiresIn, dummy: false, channel: 'sms' };
  }

  /**
   * Validate OTP for key. Consumes the entry on success.
   */
  verify(key: string, otp: string): void {
    const entry = otpStore.get(key);

    if (!entry) {
      throw new AppError('OTP not found or already used. Request a new OTP.', HTTP_STATUS.BAD_REQUEST);
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(key);
      throw new AppError('OTP has expired. Request a new OTP.', HTTP_STATUS.BAD_REQUEST);
    }

    if (entry.attempts >= MAX_ATTEMPTS) {
      otpStore.delete(key);
      throw new AppError('Too many invalid OTP attempts. Request a new OTP.', HTTP_STATUS.BAD_REQUEST);
    }

    entry.attempts += 1;

    if (entry.code !== otp) {
      throw new AppError('Invalid OTP', HTTP_STATUS.UNAUTHORIZED);
    }

    otpStore.delete(key);
  }

  /** Test helper — clear in-memory store between suites. */
  clearAll(): void {
    otpStore.clear();
  }
}

export const otpService = new OtpService();
