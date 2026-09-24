import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { Candidate } from '../models/Candidate';
import { User } from '../models/User';
import { HTTP_STATUS } from '../constants';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { comparePassword, hashPassword } from '../utils/password';
import { signAccessToken } from '../utils/jwt';
import type {
  CandidateAccountDeleteInput,
  CandidateLoginInput,
  CandidateOtpSendInput,
  CandidateOtpVerifyInput,
  CandidatePasswordForgotInput,
  CandidatePasswordResetInput,
  CandidateRegisterInput,
} from '../validators/candidateAuth.validator';
import { getFeatureFlags } from '../utils/featureFlags';
import { trackSafely } from './analytics.service';
import { otpService } from './otp.service';
import { passwordResetService } from './passwordReset.service';

const INVALID_CREDENTIALS = 'Invalid email or password';

export interface CandidateAuthResult {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: 'candidate';
  };
  candidate: {
    id: string;
    profileCompletion: number;
    profileVisibility?: string;
  };
  features: {
    videoJdEnabled: boolean;
    videoResumeEnabled: boolean;
    videoMaxBytes: number;
    videoMaxSeconds: number;
    aiResumeEnabled: boolean;
    aiMatchingEnabled: boolean;
    aiCareerCoachEnabled: boolean;
    aiRecruitmentEnabled: boolean;
    chatEnabled: boolean;
  };
  /** Present on OTP verify — true when a new account was created. */
  isNewUser?: boolean;
}

function withFeatures<T extends object>(payload: T): T & { features: CandidateAuthResult['features'] } {
  return { ...payload, features: getFeatureFlags() };
}

function otpPlaceholderEmail(phone: string): string {
  return `otp.${phone}@workindia.local`;
}

function buildAuthPayload(
  user: { _id: { toString(): string }; name: string; email: string; phone: string },
  candidate: { _id: { toString(): string }; profileCompletion?: number | null; profileVisibility?: string },
  extras?: { isNewUser?: boolean },
): CandidateAuthResult {
  const accessToken = signAccessToken({
    userId: user._id.toString(),
    role: 'candidate',
  });

  return withFeatures({
    accessToken,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: 'candidate' as const,
    },
    candidate: {
      id: candidate._id.toString(),
      profileCompletion: candidate.profileCompletion ?? 0,
      ...(candidate.profileVisibility
        ? { profileVisibility: candidate.profileVisibility }
        : {}),
    },
    ...(extras?.isNewUser !== undefined ? { isNewUser: extras.isNewUser } : {}),
  });
}

export class CandidateAuthService {
  async register(input: CandidateRegisterInput): Promise<CandidateAuthResult> {
    const existingByEmail = await User.findOne({ email: input.email }).select('_id role');
    if (existingByEmail) {
      throw new AppError('An account with this email already exists', HTTP_STATUS.CONFLICT);
    }

    const existingByPhone = await User.findOne({ phone: input.phone }).select('_id');
    if (existingByPhone) {
      throw new AppError('An account with this phone already exists', HTTP_STATUS.CONFLICT);
    }

    const passwordHash = await hashPassword(input.password);

    let createdUserId: mongoose.Types.ObjectId | null = null;

    try {
      const user = await User.create({
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash,
        role: 'candidate',
        status: 'active',
      });
      createdUserId = user._id;

      const candidate = await Candidate.create({
        userId: user._id,
        profileCompletion: 0,
        profileVisibility: 'public',
        acquisitionSource: input.acquisitionSource?.trim() || 'direct',
      });

      return buildAuthPayload(user, candidate);
    } catch (error) {
      if (createdUserId) {
        await User.deleteOne({ _id: createdUserId }).catch(() => undefined);
        await Candidate.deleteOne({ userId: createdUserId }).catch(() => undefined);
      }

      if (error instanceof AppError) {
        throw error;
      }

      if (isDuplicateKeyError(error)) {
        throw new AppError('An account with these details already exists', HTTP_STATUS.CONFLICT);
      }

      throw error;
    }
  }

  async login(input: CandidateLoginInput): Promise<CandidateAuthResult> {
    const user = await User.findOne({ email: input.email }).select('+passwordHash');

    if (!user || user.role !== 'candidate' || user.deletedAt) {
      throw new AppError(INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    if (user.status !== 'active') {
      throw new AppError(INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    const candidate = await Candidate.findOne({ userId: user._id });

    if (!candidate) {
      throw new AppError(INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    const passwordMatches = await comparePassword(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError(INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    user.lastLoginAt = new Date();
    await user.save();

    await trackSafely({
      eventType: 'candidate_login',
      userId: user._id,
      actorRole: 'candidate',
      entityType: 'candidate',
      entityId: candidate._id,
      candidateId: candidate._id,
    });

    return buildAuthPayload(user, candidate);
  }

  async sendOtp(
    input: CandidateOtpSendInput,
  ): Promise<{ phone: string; expiresIn: number; dummy: boolean; channel: 'sms' | 'email' | 'none' }> {
    const result = otpService.send(input.phone, {
      destination: input.phone,
      channel: 'sms',
      purpose: 'candidate_login',
    });
    return {
      phone: input.phone,
      expiresIn: result.expiresIn,
      dummy: result.dummy,
      channel: result.channel,
    };
  }

  async verifyOtp(input: CandidateOtpVerifyInput): Promise<CandidateAuthResult> {
    const existing = await User.findOne({ phone: input.phone, role: 'candidate' });
    const isReturning = Boolean(existing && !existing.deletedAt);
    const name = input.name?.trim() ?? '';

    if (!isReturning && !name) {
      throw new AppError(
        'Name is required for first-time mobile signup',
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    otpService.verify(input.phone, input.otp);

    if (isReturning && existing) {
      if (existing.status !== 'active') {
        throw new AppError('Candidate access denied', HTTP_STATUS.FORBIDDEN);
      }

      let candidate = await Candidate.findOne({ userId: existing._id });
      if (!candidate) {
        candidate = await Candidate.create({
          userId: existing._id,
          profileCompletion: 0,
          profileVisibility: 'public',
        });
      }

      existing.phoneVerified = true;
      existing.lastLoginAt = new Date();
      await existing.save();

      await trackSafely({
        eventType: 'candidate_login',
        userId: existing._id,
        actorRole: 'candidate',
        entityType: 'candidate',
        entityId: candidate._id,
        candidateId: candidate._id,
      });

      return buildAuthPayload(existing, candidate, { isNewUser: false });
    }

    const passwordHash = await hashPassword(randomBytes(32).toString('hex'));
    let createdUserId: mongoose.Types.ObjectId | null = null;

    try {
      const user = await User.create({
        name,
        email: otpPlaceholderEmail(input.phone),
        phone: input.phone,
        passwordHash,
        role: 'candidate',
        status: 'active',
        phoneVerified: true,
      });
      createdUserId = user._id;

      const candidate = await Candidate.create({
        userId: user._id,
        profileCompletion: 0,
        profileVisibility: 'public',
      });

      user.lastLoginAt = new Date();
      await user.save();

      await trackSafely({
        eventType: 'candidate_login',
        userId: user._id,
        actorRole: 'candidate',
        entityType: 'candidate',
        entityId: candidate._id,
        candidateId: candidate._id,
      });

      return buildAuthPayload(user, candidate, { isNewUser: true });
    } catch (error) {
      if (createdUserId) {
        await User.deleteOne({ _id: createdUserId }).catch(() => undefined);
        await Candidate.deleteOne({ userId: createdUserId }).catch(() => undefined);
      }

      if (error instanceof AppError) {
        throw error;
      }

      if (isDuplicateKeyError(error)) {
        throw new AppError('An account with this phone already exists', HTTP_STATUS.CONFLICT);
      }

      throw error;
    }
  }

  /**
   * Request a password-reset OTP for email or phone.
   * Always returns a generic success shape (no account enumeration).
   * Code is only stored when a matching active candidate exists.
   */
  async forgotPassword(
    input: CandidatePasswordForgotInput,
  ): Promise<{ expiresIn: number; dummy: boolean; channel: 'email' | 'phone' }> {
    const email = input.email?.trim() ?? '';
    const phone = input.phone?.trim() ?? '';
    const channel: 'email' | 'phone' = email ? 'email' : 'phone';
    const dummy = Boolean(env.candidateOtpDummy);
    const expiresIn = env.candidateOtpTtlSeconds;

    const user = email
      ? await User.findOne({ email, role: 'candidate' }).select('_id status deletedAt')
      : await User.findOne({ phone, role: 'candidate' }).select('_id status deletedAt');

    if (user && !user.deletedAt && user.status === 'active') {
      const key = passwordResetKey(email || phone);
      passwordResetService.send(key);
    }

    return { expiresIn, dummy, channel };
  }

  async resetPassword(
    input: CandidatePasswordResetInput,
  ): Promise<{ reset: true }> {
    const email = input.email?.trim() ?? '';
    const phone = input.phone?.trim() ?? '';
    const key = passwordResetKey(email || phone);

    passwordResetService.verify(key, input.otp);

    const user = email
      ? await User.findOne({ email, role: 'candidate' }).select('+passwordHash status deletedAt')
      : await User.findOne({ phone, role: 'candidate' }).select('+passwordHash status deletedAt');

    if (!user || user.deletedAt || user.status !== 'active') {
      throw new AppError('Account not found for password reset', HTTP_STATUS.BAD_REQUEST);
    }

    user.passwordHash = await hashPassword(input.password);
    await user.save();

    return { reset: true };
  }

  /**
   * Soft-deactivate account (status → inactive). Profile is hidden; login is blocked.
   * Admin can re-activate later.
   */
  async deactivateAccount(userId: string): Promise<{ deactivated: true; status: 'inactive' }> {
    const user = await User.findById(userId).select('role status deletedAt');
    if (!user || user.role !== 'candidate' || user.deletedAt) {
      throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
    }
    if (user.status === 'deleted') {
      throw new AppError('Account is already deleted', HTTP_STATUS.CONFLICT);
    }
    if (user.status === 'inactive') {
      return { deactivated: true, status: 'inactive' };
    }

    user.status = 'inactive';
    await user.save();

    await Candidate.updateOne(
      { userId: user._id },
      { $set: { profileVisibility: 'private' } },
    );

    return { deactivated: true, status: 'inactive' };
  }

  /**
   * Soft-delete account (status → deleted + deletedAt).
   * Email/phone are anonymized so the same credentials can register again.
   */
  async deleteAccount(
    userId: string,
    _input: CandidateAccountDeleteInput,
  ): Promise<{ deleted: true }> {
    const user = await User.findById(userId).select('role status deletedAt email phone');
    if (!user || user.role !== 'candidate') {
      throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
    }
    if (user.deletedAt || user.status === 'deleted') {
      return { deleted: true };
    }

    const stamp = Date.now();
    const id = user._id.toString();
    user.status = 'deleted';
    user.deletedAt = new Date();
    user.email = `deleted.${id}.${stamp}@deleted.local`;
    user.phone = '';
    user.emailVerified = false;
    user.phoneVerified = false;
    await user.save();

    await Candidate.updateOne(
      { userId: user._id },
      { $set: { profileVisibility: 'private' } },
    );

    return { deleted: true };
  }

  async getProfile(userId: string): Promise<Omit<CandidateAuthResult, 'accessToken'>> {
    const [user, candidate] = await Promise.all([
      User.findById(userId).select('name email phone role status deletedAt'),
      Candidate.findOne({ userId }).select('_id profileCompletion profileVisibility'),
    ]);

    if (!user || user.role !== 'candidate' || user.deletedAt || !candidate) {
      throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
    }

    if (user.status !== 'active') {
      throw new AppError('Candidate access denied', HTTP_STATUS.FORBIDDEN);
    }

    return withFeatures({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: 'candidate',
      },
      candidate: {
        id: candidate._id.toString(),
        profileCompletion: candidate.profileCompletion ?? 0,
        profileVisibility: candidate.profileVisibility,
      },
    });
  }
}

function passwordResetKey(identifier: string): string {
  return `candidate:${identifier}`;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

export const candidateAuthService = new CandidateAuthService();
