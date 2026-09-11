import { HTTP_STATUS } from '../constants';
import type { AccountStatus, AdminRole } from '../constants/enums';
import {
  ALL_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  type Permission,
} from '../constants/permissions';
import { AdminUser } from '../models/AdminUser';
import { User } from '../models/User';
import type { AuthenticatedAdmin } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { mapAdminUserResponse } from '../utils/adminManagementMapper';
import { hashPassword } from '../utils/password';
import { writeAuditSafely } from './audit.service';
import type {
  AdminUserCreateInput,
  AdminUserListQuery,
  AdminUserRoleInput,
  AdminUserStatusInput,
  AdminUserUpdateInput,
} from '../validators/adminManagement.validator';

function isSuperAdmin(admin: AuthenticatedAdmin): boolean {
  return admin.role === 'super_admin';
}

async function countActiveSuperAdmins(): Promise<number> {
  const supers = await AdminUser.find({ role: 'super_admin', status: 'active' }).select('userId');
  if (supers.length === 0) return 0;
  const users = await User.find({
    _id: { $in: supers.map((s) => s.userId) },
    role: 'admin',
    status: 'active',
    deletedAt: null,
  }).select('_id');
  return users.length;
}

function resolvePermissions(
  role: AdminRole,
  requested: string[] | undefined,
  actor: AuthenticatedAdmin,
): Permission[] {
  if (requested !== undefined) {
    if (!isSuperAdmin(actor)) {
      throw new AppError(
        'Only super_admin can assign custom permissions',
        HTTP_STATUS.FORBIDDEN,
      );
    }
    const invalid = requested.filter((p) => !(ALL_PERMISSIONS as readonly string[]).includes(p));
    if (invalid.length) {
      throw new AppError('Invalid permissions', HTTP_STATUS.BAD_REQUEST, [
        { path: 'permissions', message: `Unknown: ${invalid.join(', ')}` },
      ]);
    }
    return requested as Permission[];
  }
  return [...ROLE_DEFAULT_PERMISSIONS[role]];
}

export class AdminUserService {
  async list(query: AdminUserListQuery) {
    const filter: Record<string, unknown> = {};
    if (query.role) filter.role = query.role;
    if (query.status) filter.status = query.status;

    const skip = (query.page - 1) * query.limit;
    const sort: Record<string, 1 | -1> = {
      [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1,
    };

    let admins = await AdminUser.find(filter).sort(sort).limit(5000);
    const userIds = admins.map((a) => a.userId);
    const users = await User.find({ _id: { $in: userIds }, role: 'admin' }).select(
      'name email phone status emailVerified createdAt updatedAt',
    );
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    let items = admins
      .map((admin) => {
        const user = userMap.get(admin.userId.toString());
        if (!user) return null;
        if (query.email && user.email.toLowerCase() !== query.email.toLowerCase()) return null;
        if (query.search) {
          const q = query.search.toLowerCase();
          const hay = `${user.name} ${user.email}`.toLowerCase();
          if (!hay.includes(q)) return null;
        }
        return mapAdminUserResponse({ admin, user });
      })
      .filter(Boolean);

    const total = items.length;
    items = items.slice(skip, skip + query.limit);

    return {
      adminUsers: items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getById(id: string) {
    const admin = await AdminUser.findById(id);
    if (!admin) throw new AppError('Admin user not found', HTTP_STATUS.NOT_FOUND);
    const user = await User.findById(admin.userId).select(
      'name email phone role status emailVerified createdAt updatedAt',
    );
    if (!user || user.role !== 'admin') {
      throw new AppError('Admin user not found', HTTP_STATUS.NOT_FOUND);
    }
    return { adminUser: mapAdminUserResponse({ admin, user }) };
  }

  async create(actor: AuthenticatedAdmin, input: AdminUserCreateInput) {
    const role = input.role as AdminRole;
    if (role === 'super_admin' && !isSuperAdmin(actor)) {
      throw new AppError('Only super_admin can create super_admin accounts', HTTP_STATUS.FORBIDDEN);
    }

    const email = input.email.trim().toLowerCase();
    const existing = await User.findOne({ email });
    if (existing) {
      throw new AppError('An account with this email already exists', HTTP_STATUS.CONFLICT);
    }

    const permissions = resolvePermissions(role, input.permissions, actor);
    const passwordHash = await hashPassword(input.password);

    // Ordered writes (standalone MongoDB has no replica-set transactions).
    const user = await User.create({
      name: input.name.trim(),
      email,
      passwordHash,
      role: 'admin',
      status: 'active',
      emailVerified: true,
    });

    let admin;
    try {
      admin = await AdminUser.create({
        userId: user._id,
        role,
        permissions,
        status: (input.status ?? 'active') as AccountStatus,
      });
    } catch (error) {
      await User.deleteOne({ _id: user._id }).catch(() => undefined);
      throw error;
    }

    await writeAuditSafely({
      admin: actor,
      action: 'admin_user_created',
      entityType: 'admin_user',
      entityId: admin._id,
      metadata: { role, email },
    });

    return {
      adminUser: mapAdminUserResponse({ admin, user }),
    };
  }

  async update(actor: AuthenticatedAdmin, id: string, input: AdminUserUpdateInput) {
    const admin = await AdminUser.findById(id);
    if (!admin) throw new AppError('Admin user not found', HTTP_STATUS.NOT_FOUND);
    const user = await User.findById(admin.userId);
    if (!user || user.role !== 'admin') {
      throw new AppError('Admin user not found', HTTP_STATUS.NOT_FOUND);
    }

    if (input.email) {
      const email = input.email.trim().toLowerCase();
      const clash = await User.findOne({ email, _id: { $ne: user._id } });
      if (clash) {
        throw new AppError('An account with this email already exists', HTTP_STATUS.CONFLICT);
      }
      user.email = email;
    }
    if (input.name) user.name = input.name.trim();
    await user.save();

    await writeAuditSafely({
      admin: actor,
      action: 'admin_user_updated',
      entityType: 'admin_user',
      entityId: admin._id,
      metadata: { fields: Object.keys(input) },
    });

    return this.getById(id);
  }

  async updateStatus(actor: AuthenticatedAdmin, id: string, input: AdminUserStatusInput) {
    const admin = await AdminUser.findById(id);
    if (!admin) throw new AppError('Admin user not found', HTTP_STATUS.NOT_FOUND);

    if (admin._id.toString() === actor.adminUserId && input.status !== 'active') {
      throw new AppError('Cannot deactivate your own admin account', HTTP_STATUS.BAD_REQUEST);
    }

    if (admin.role === 'super_admin' && input.status !== 'active') {
      const count = await countActiveSuperAdmins();
      if (count <= 1) {
        throw new AppError(
          'Cannot suspend/deactivate the last active super_admin',
          HTTP_STATUS.CONFLICT,
        );
      }
      if (!isSuperAdmin(actor)) {
        throw new AppError('Only super_admin can change super_admin status', HTTP_STATUS.FORBIDDEN);
      }
    }

    const previous = admin.status;
    admin.status = input.status;
    await admin.save();

    // Mirror non-active admin status onto User for auth consistency.
    if (input.status !== 'active') {
      await User.updateOne(
        { _id: admin.userId },
        { $set: { status: input.status === 'suspended' ? 'suspended' : 'inactive' } },
      );
    } else {
      await User.updateOne({ _id: admin.userId }, { $set: { status: 'active' } });
    }

    await writeAuditSafely({
      admin: actor,
      action: 'admin_status_changed',
      entityType: 'admin_user',
      entityId: admin._id,
      metadata: { from: previous, to: input.status },
    });

    return this.getById(id);
  }

  async updateRole(actor: AuthenticatedAdmin, id: string, input: AdminUserRoleInput) {
    if (!isSuperAdmin(actor)) {
      throw new AppError('Only super_admin can change admin roles', HTTP_STATUS.FORBIDDEN);
    }

    const admin = await AdminUser.findById(id);
    if (!admin) throw new AppError('Admin user not found', HTTP_STATUS.NOT_FOUND);

    const nextRole = input.role as AdminRole;
    if (admin.role === 'super_admin' && nextRole !== 'super_admin') {
      const count = await countActiveSuperAdmins();
      if (count <= 1) {
        throw new AppError(
          'Cannot demote the last active super_admin',
          HTTP_STATUS.CONFLICT,
        );
      }
    }

    if (admin._id.toString() === actor.adminUserId && nextRole !== 'super_admin') {
      const count = await countActiveSuperAdmins();
      if (count <= 1) {
        throw new AppError(
          'Cannot self-demote the last active super_admin',
          HTTP_STATUS.CONFLICT,
        );
      }
    }

    const previous = admin.role;
    admin.role = nextRole;
    admin.permissions = resolvePermissions(nextRole, input.permissions, actor);
    await admin.save();

    await writeAuditSafely({
      admin: actor,
      action: 'admin_role_changed',
      entityType: 'admin_user',
      entityId: admin._id,
      metadata: { from: previous, to: nextRole },
    });

    return this.getById(id);
  }

  async remove(actor: AuthenticatedAdmin, id: string) {
    if (!isSuperAdmin(actor)) {
      throw new AppError('Only super_admin can delete admin users', HTTP_STATUS.FORBIDDEN);
    }

    const admin = await AdminUser.findById(id);
    if (!admin) throw new AppError('Admin user not found', HTTP_STATUS.NOT_FOUND);

    if (admin._id.toString() === actor.adminUserId) {
      throw new AppError('Cannot delete your own admin account', HTTP_STATUS.BAD_REQUEST);
    }

    if (admin.role === 'super_admin') {
      const count = await countActiveSuperAdmins();
      if (count <= 1) {
        throw new AppError('Cannot delete the last active super_admin', HTTP_STATUS.CONFLICT);
      }
    }

    const userId = admin.userId;
    await AdminUser.deleteOne({ _id: admin._id });
    await User.updateOne(
      { _id: userId },
      { $set: { status: 'deleted', deletedAt: new Date() } },
    );

    await writeAuditSafely({
      admin: actor,
      action: 'admin_user_deleted',
      entityType: 'admin_user',
      entityId: id,
      metadata: { userId: userId.toString() },
    });

    return { deleted: true, id };
  }
}

export const adminUserService = new AdminUserService();
