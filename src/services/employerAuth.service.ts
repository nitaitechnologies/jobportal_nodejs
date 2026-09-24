import mongoose from 'mongoose';
import { env } from '../config/env';
import { Company } from '../models/Company';
import { Employer } from '../models/Employer';
import { User } from '../models/User';
import { HTTP_STATUS } from '../constants';
import type { EmployerTeamRole } from '../constants/enums';
import { permissionsForTeamRole } from '../constants/employerPermissions';
import { AppError } from '../utils/AppError';
import { comparePassword, hashPassword } from '../utils/password';
import { createUniqueSlug } from '../utils/slug';
import type {
  EmployerLoginInput,
  EmployerRegisterInput,
  EmployerVerifyOtpInput,
} from '../validators/employerAuth.validator';
import { getFeatureFlags } from '../utils/featureFlags';
import { trackSafely } from './analytics.service';
import { authSessionService, type SessionDeviceMeta } from './authSession.service';
import { otpService } from './otp.service';

const INVALID_CREDENTIALS = 'Invalid email or password';

export interface EmployerAuthResult {
  accessToken: string;
  sessionId?: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: 'employer';
    phoneVerified: boolean;
    emailVerified: boolean;
  };
  employer: {
    id: string;
    companyId: string;
    teamRole: EmployerTeamRole;
    designation?: string;
    permissions: string[];
    verified: boolean;
  };
  company: {
    id: string;
    name: string;
    slug: string;
    verificationStatus: string;
    status?: string;
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
}

function withFeatures<T extends object>(
  payload: T,
): T & { features: EmployerAuthResult['features'] } {
  return { ...payload, features: getFeatureFlags() };
}

function resolveTeamRole(input: EmployerRegisterInput): EmployerTeamRole {
  const raw = (input.teamRole ?? '').trim().toLowerCase();
  if (raw === 'hr') return 'hr';
  if (raw === 'recruiter') return 'recruiter';
  return 'owner';
}

function designationFor(role: EmployerTeamRole, explicit?: string): string {
  if (explicit?.trim()) return explicit.trim().slice(0, 120);
  if (role === 'owner') return 'Owner';
  if (role === 'hr') return 'HR';
  return 'Recruiter';
}

function mapAuthPayload(
  user: {
    _id: { toString(): string };
    name: string;
    email: string;
    phone?: string | null;
    phoneVerified?: boolean;
    emailVerified?: boolean;
  },
  employer: {
    _id: { toString(): string };
    companyId?: { toString(): string } | null;
    teamRole?: string | null;
    designation?: string | null;
    verified?: boolean;
  },
  company: {
    _id: { toString(): string };
    name: string;
    slug: string;
    verificationStatus: string;
    status?: string;
  },
  accessToken: string,
  sessionId?: string,
): EmployerAuthResult {
  const teamRole = (employer.teamRole as EmployerTeamRole) || 'owner';
  return withFeatures({
    accessToken,
    sessionId,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      role: 'employer',
      phoneVerified: Boolean(user.phoneVerified),
      emailVerified: Boolean(user.emailVerified),
    },
    employer: {
      id: employer._id.toString(),
      companyId: (employer.companyId ?? company._id).toString(),
      teamRole,
      designation: employer.designation || undefined,
      permissions: permissionsForTeamRole(teamRole),
      verified: Boolean(employer.verified),
    },
    company: {
      id: company._id.toString(),
      name: company.name,
      slug: company.slug,
      verificationStatus: company.verificationStatus,
      status: company.status,
    },
  });
}

export class EmployerAuthService {
  async register(
    input: EmployerRegisterInput,
    meta: SessionDeviceMeta = {},
  ): Promise<EmployerAuthResult> {
    const existingByEmail = await User.findOne({ email: input.email }).select('_id');
    if (existingByEmail) {
      throw new AppError('An account with this email already exists', HTTP_STATUS.CONFLICT);
    }

    const existingByPhone = await User.findOne({ phone: input.phone }).select('_id');
    if (existingByPhone) {
      throw new AppError('An account with this phone already exists', HTTP_STATUS.CONFLICT);
    }

    const passwordHash = await hashPassword(input.password);
    const slug = await createUniqueSlug(input.companyName, async (value) => {
      const existing = await Company.findOne({ slug: value }).select('_id');
      return Boolean(existing);
    });

    const teamRole = resolveTeamRole(input);
    // First account for a new company is always owner (join existing via invite).
    const effectiveRole: EmployerTeamRole = 'owner';

    let createdUserId: mongoose.Types.ObjectId | null = null;
    let createdCompanyId: mongoose.Types.ObjectId | null = null;

    try {
      const user = await User.create({
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash,
        role: 'employer',
        status: 'active',
      });
      createdUserId = user._id;

      const company = await Company.create({
        name: input.companyName,
        slug,
        verificationStatus: 'pending',
        status: 'active',
        contactEmail: input.email,
        contactPhone: input.phone,
      });
      createdCompanyId = company._id;

      const employer = await Employer.create({
        userId: user._id,
        companyId: company._id,
        teamRole: effectiveRole,
        designation: designationFor(effectiveRole, input.designation ?? teamRole),
        verified: false,
        status: 'active',
      });

      const { accessToken, sessionId } = await authSessionService.createAccessToken(
        user._id.toString(),
        'employer',
        meta,
        { maxSessions: env.employerMaxSessions },
      );

      return mapAuthPayload(user, employer, company, accessToken, sessionId);
    } catch (error) {
      if (createdUserId) {
        await Employer.deleteOne({ userId: createdUserId }).catch(() => undefined);
        await User.deleteOne({ _id: createdUserId }).catch(() => undefined);
      }
      if (createdCompanyId) {
        await Company.deleteOne({ _id: createdCompanyId }).catch(() => undefined);
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

  async login(
    input: EmployerLoginInput,
    meta: SessionDeviceMeta = {},
  ): Promise<EmployerAuthResult> {
    const user = await User.findOne({ email: input.email }).select('+passwordHash');

    if (!user || user.role !== 'employer' || user.deletedAt) {
      throw new AppError(INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    if (user.status !== 'active') {
      throw new AppError(INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    const employer = await Employer.findOne({ userId: user._id });
    if (!employer || employer.status !== 'active' || !employer.companyId) {
      throw new AppError(INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    const company = await Company.findById(employer.companyId);
    if (!company || company.status === 'suspended') {
      throw new AppError(INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    const passwordMatches = await comparePassword(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new AppError(INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    user.lastLoginAt = new Date();
    await user.save();

    const { accessToken, sessionId } = await authSessionService.createAccessToken(
      user._id.toString(),
      'employer',
      meta,
      { maxSessions: env.employerMaxSessions },
    );

    await trackSafely({
      eventType: 'employer_login',
      userId: user._id,
      actorRole: 'employer',
      entityType: 'employer',
      entityId: employer._id,
      employerId: employer._id,
      companyId: company._id,
    });

    return mapAuthPayload(user, employer, company, accessToken, sessionId);
  }

  async getProfile(userId: string): Promise<Omit<EmployerAuthResult, 'accessToken' | 'sessionId'>> {
    const [user, employer] = await Promise.all([
      User.findById(userId).select('name email phone role status deletedAt phoneVerified emailVerified'),
      Employer.findOne({ userId }),
    ]);

    if (!user || user.role !== 'employer' || user.deletedAt || !employer || !employer.companyId) {
      throw new AppError('Employer not found', HTTP_STATUS.NOT_FOUND);
    }

    if (user.status !== 'active' || employer.status !== 'active') {
      throw new AppError('Employer access denied', HTTP_STATUS.FORBIDDEN);
    }

    const company = await Company.findById(employer.companyId);
    if (!company) {
      throw new AppError('Employer not found', HTTP_STATUS.NOT_FOUND);
    }

    const mapped = mapAuthPayload(user, employer, company, '');
    const { accessToken: _token, sessionId: _sid, ...rest } = mapped;
    return rest;
  }

  async sendVerificationOtp(userId: string, channel: 'phone' | 'email') {
    const user = await User.findById(userId).select('phone email role status');
    if (!user || user.role !== 'employer' || user.status !== 'active') {
      throw new AppError('Employer not found', HTTP_STATUS.NOT_FOUND);
    }

    if (channel === 'phone') {
      const phone = (user.phone ?? '').trim();
      if (!phone) {
        throw new AppError('Add a phone number to your profile first', HTTP_STATUS.BAD_REQUEST);
      }
      const result = otpService.send(`employer:phone:${phone}`, {
        destination: phone,
        channel: 'sms',
        purpose: 'employer_phone_verify',
      });
      return { destination: phone.replace(/.(?=.{4})/g, '•'), ...result, channel };
    }

    const email = (user.email ?? '').trim().toLowerCase();
    if (!email) {
      throw new AppError('Add an email to your profile first', HTTP_STATUS.BAD_REQUEST);
    }
    const result = otpService.send(`employer:email:${email}`, {
      destination: email,
      channel: 'email',
      purpose: 'employer_email_verify',
    });
    return { destination: email.replace(/(?<=.).(?=[^@]*?@)/g, '•'), ...result, channel };
  }

  async verifyContact(
    userId: string,
    input: EmployerVerifyOtpInput,
  ): Promise<{ phoneVerified: boolean; emailVerified: boolean; verified: boolean }> {
    const user = await User.findById(userId).select('phone email role status phoneVerified emailVerified');
    if (!user || user.role !== 'employer' || user.status !== 'active') {
      throw new AppError('Employer not found', HTTP_STATUS.NOT_FOUND);
    }

    if (input.channel === 'phone') {
      const phone = (user.phone ?? '').trim();
      otpService.verify(`employer:phone:${phone}`, input.otp);
      user.phoneVerified = true;
    } else {
      const email = (user.email ?? '').trim().toLowerCase();
      otpService.verify(`employer:email:${email}`, input.otp);
      user.emailVerified = true;
    }
    await user.save();

    const employer = await Employer.findOne({ userId: user._id });
    if (employer) {
      employer.verified = Boolean(user.phoneVerified || user.emailVerified);
      await employer.save();
    }

    return {
      phoneVerified: Boolean(user.phoneVerified),
      emailVerified: Boolean(user.emailVerified),
      verified: Boolean(employer?.verified),
    };
  }

  async logout(userId: string, sessionId?: string) {
    if (sessionId) {
      return authSessionService.revoke(sessionId, userId);
    }
    return { revoked: false };
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

export const employerAuthService = new EmployerAuthService();
