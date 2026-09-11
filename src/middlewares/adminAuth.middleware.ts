import { NextFunction, Request, Response } from 'express';
import { AdminUser } from '../models/AdminUser';
import { User } from '../models/User';
import { HTTP_STATUS } from '../constants';
import type { AdminRole } from '../constants/enums';
import type { Permission } from '../constants/permissions';
import type { AuthenticatedAdmin } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import '../types/express';

/**
 * Authorization: ensure authenticated identity is an active admin.
 * Must run after authenticate().
 */
export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.auth) {
      throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
    }

    if (req.auth.role !== 'admin') {
      throw new AppError('Admin access required', HTTP_STATUS.FORBIDDEN);
    }

    if (!req.auth.adminUserId) {
      throw new AppError('Admin access required', HTTP_STATUS.FORBIDDEN);
    }

    const [user, adminUser] = await Promise.all([
      User.findById(req.auth.userId).select('name email role status deletedAt'),
      AdminUser.findById(req.auth.adminUserId),
    ]);

    if (!user || user.role !== 'admin' || user.status !== 'active' || user.deletedAt) {
      throw new AppError('Admin access denied', HTTP_STATUS.FORBIDDEN);
    }

    if (!adminUser || adminUser.status !== 'active') {
      throw new AppError('Admin access denied', HTTP_STATUS.FORBIDDEN);
    }

    if (adminUser.userId.toString() !== user._id.toString()) {
      throw new AppError('Admin access denied', HTTP_STATUS.FORBIDDEN);
    }

    const admin: AuthenticatedAdmin = {
      adminUserId: adminUser._id.toString(),
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      role: adminUser.role,
      permissions: adminUser.permissions ?? [],
      status: adminUser.status,
    };

    req.admin = admin;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Restrict access to specific AdminUser roles.
 */
export function requireAdminRole(...roles: AdminRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.admin) {
        throw new AppError('Admin access required', HTTP_STATUS.FORBIDDEN);
      }

      if (!roles.includes(req.admin.role)) {
        throw new AppError('Insufficient admin role', HTTP_STATUS.FORBIDDEN);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Restrict access to a specific permission key.
 * super_admin bypasses permission checks.
 */
export function requirePermission(permission: Permission) {
  return requireAnyPermission(permission);
}

/**
 * Restrict access if the admin has ANY of the listed permissions.
 * super_admin bypasses.
 */
export function requireAnyPermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.admin) {
        throw new AppError('Admin access required', HTTP_STATUS.FORBIDDEN);
      }

      if (req.admin.role === 'super_admin') {
        next();
        return;
      }

      const ok = permissions.some((p) => req.admin!.permissions.includes(p));
      if (!ok) {
        throw new AppError('Insufficient permissions', HTTP_STATUS.FORBIDDEN);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
