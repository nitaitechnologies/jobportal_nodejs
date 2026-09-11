import { AdminUser } from '../models/AdminUser';
import { User } from '../models/User';
import { HTTP_STATUS } from '../constants';
import type { AdminRole } from '../constants/enums';
import { AppError } from '../utils/AppError';
import { comparePassword } from '../utils/password';
import { signAccessToken } from '../utils/jwt';
import type { AdminLoginInput } from '../validators/adminAuth.validator';
import { trackSafely } from './analytics.service';

const INVALID_CREDENTIALS = 'Invalid email or password';

export interface AdminLoginResult {
  accessToken: string;
  admin: {
    id: string;
    name: string;
    email: string;
    role: AdminRole;
  };
}

export interface AdminProfileResult {
  admin: {
    id: string;
    userId: string;
    name: string;
    email: string;
    role: AdminRole;
    permissions: string[];
    status: string;
  };
}

export class AdminAuthService {
  async login(input: AdminLoginInput): Promise<AdminLoginResult> {
    const user = await User.findOne({ email: input.email }).select('+passwordHash');

    if (!user || user.role !== 'admin' || user.deletedAt) {
      throw new AppError(INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    if (user.status !== 'active') {
      throw new AppError(INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    const adminUser = await AdminUser.findOne({ userId: user._id });

    if (!adminUser || adminUser.status !== 'active') {
      throw new AppError(INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    const passwordMatches = await comparePassword(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError(INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    const now = new Date();
    user.lastLoginAt = now;
    adminUser.lastLoginAt = now;

    await Promise.all([user.save(), adminUser.save()]);

    const accessToken = signAccessToken({
      userId: user._id.toString(),
      role: 'admin',
      adminUserId: adminUser._id.toString(),
    });

    await trackSafely({
      eventType: 'admin_login',
      userId: user._id,
      actorRole: 'admin',
      entityType: 'user',
      entityId: user._id,
    });

    return {
      accessToken,
      admin: {
        id: adminUser._id.toString(),
        name: user.name,
        email: user.email,
        role: adminUser.role,
      },
    };
  }

  async getProfile(adminUserId: string, userId: string): Promise<AdminProfileResult> {
    const [user, adminUser] = await Promise.all([
      User.findById(userId).select('name email role status deletedAt'),
      AdminUser.findById(adminUserId),
    ]);

    if (!user || !adminUser || user.role !== 'admin' || user.deletedAt) {
      throw new AppError('Admin not found', HTTP_STATUS.NOT_FOUND);
    }

    if (user.status !== 'active' || adminUser.status !== 'active') {
      throw new AppError('Admin access denied', HTTP_STATUS.FORBIDDEN);
    }

    return {
      admin: {
        id: adminUser._id.toString(),
        userId: user._id.toString(),
        name: user.name,
        email: user.email,
        role: adminUser.role,
        permissions: adminUser.permissions ?? [],
        status: adminUser.status,
      },
    };
  }
}

export const adminAuthService = new AdminAuthService();
