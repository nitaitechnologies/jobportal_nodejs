import mongoose from 'mongoose';
import { Company } from '../models/Company';
import { Employer } from '../models/Employer';
import { User } from '../models/User';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import { comparePassword, hashPassword } from '../utils/password';
import { signAccessToken } from '../utils/jwt';
import { createUniqueSlug } from '../utils/slug';
import type {
  EmployerLoginInput,
  EmployerRegisterInput,
} from '../validators/employerAuth.validator';
import { getFeatureFlags } from '../utils/featureFlags';
import { trackSafely } from './analytics.service';

const INVALID_CREDENTIALS = 'Invalid email or password';

export interface EmployerAuthResult {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: 'employer';
  };
  employer: {
    id: string;
    companyId: string;
    designation?: string;
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
  };
}

function withFeatures<T extends object>(
  payload: T,
): T & { features: EmployerAuthResult['features'] } {
  return { ...payload, features: getFeatureFlags() };
}

export class EmployerAuthService {
  async register(input: EmployerRegisterInput): Promise<EmployerAuthResult> {
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
        verified: false,
        status: 'active',
      });

      const accessToken = signAccessToken({
        userId: user._id.toString(),
        role: 'employer',
      });

      return withFeatures({
        accessToken,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: 'employer',
        },
        employer: {
          id: employer._id.toString(),
          companyId: company._id.toString(),
        },
        company: {
          id: company._id.toString(),
          name: company.name,
          slug: company.slug,
          verificationStatus: company.verificationStatus,
        },
      });
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

  async login(input: EmployerLoginInput): Promise<EmployerAuthResult> {
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

    const accessToken = signAccessToken({
      userId: user._id.toString(),
      role: 'employer',
    });

    await trackSafely({
      eventType: 'employer_login',
      userId: user._id,
      actorRole: 'employer',
      entityType: 'employer',
      entityId: employer._id,
      employerId: employer._id,
      companyId: company._id,
    });

    return withFeatures({
      accessToken,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: 'employer',
      },
      employer: {
        id: employer._id.toString(),
        companyId: company._id.toString(),
        designation: employer.designation || undefined,
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

  async getProfile(userId: string): Promise<Omit<EmployerAuthResult, 'accessToken'>> {
    const [user, employer] = await Promise.all([
      User.findById(userId).select('name email phone role status deletedAt'),
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

    return withFeatures({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: 'employer',
      },
      employer: {
        id: employer._id.toString(),
        companyId: company._id.toString(),
        designation: employer.designation || undefined,
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
