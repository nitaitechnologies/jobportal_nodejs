import mongoose from 'mongoose';
import { Candidate } from '../models/Candidate';
import { User } from '../models/User';
import { HTTP_STATUS } from '../constants';
import { AppError } from '../utils/AppError';
import { comparePassword, hashPassword } from '../utils/password';
import { signAccessToken } from '../utils/jwt';
import type {
  CandidateLoginInput,
  CandidateRegisterInput,
} from '../validators/candidateAuth.validator';
import { getFeatureFlags } from '../utils/featureFlags';
import { trackSafely } from './analytics.service';

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
  };
}

function withFeatures<T extends object>(payload: T): T & { features: CandidateAuthResult['features'] } {
  return { ...payload, features: getFeatureFlags() };
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
      });

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
          role: 'candidate',
        },
        candidate: {
          id: candidate._id.toString(),
          profileCompletion: candidate.profileCompletion ?? 0,
        },
      });
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

    const accessToken = signAccessToken({
      userId: user._id.toString(),
      role: 'candidate',
    });

    await trackSafely({
      eventType: 'candidate_login',
      userId: user._id,
      actorRole: 'candidate',
      entityType: 'candidate',
      entityId: candidate._id,
      candidateId: candidate._id,
    });

    return withFeatures({
      accessToken,
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
      },
    });
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

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

export const candidateAuthService = new CandidateAuthService();
