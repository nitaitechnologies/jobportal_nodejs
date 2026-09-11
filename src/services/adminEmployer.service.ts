import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import { Company } from '../models/Company';
import { Employer } from '../models/Employer';
import { User } from '../models/User';
import type { AuthenticatedAdmin } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { mapAdminEmployerResponse } from '../utils/adminManagementMapper';
import { writeAuditSafely } from './audit.service';
import { notifySafely, resolveEmployerUserId } from './notification.service';
import type {
  AdminEmployerListQuery,
  AdminEmployerStatusInput,
} from '../validators/adminManagement.validator';

export class AdminEmployerService {
  async list(query: AdminEmployerListQuery) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) (filter.createdAt as Record<string, Date>).$gte = new Date(query.from);
      if (query.to) (filter.createdAt as Record<string, Date>).$lte = new Date(query.to);
    }

    const employers = await Employer.find(filter)
      .sort({
        [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1,
      })
      .limit(5000);

    const users = await User.find({
      _id: { $in: employers.map((e) => e.userId) },
      role: 'employer',
      ...(query.userStatus ? { status: query.userStatus } : {}),
      ...(query.email ? { email: query.email.trim().toLowerCase() } : {}),
    }).select('name email phone status lastLoginAt createdAt');

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));
    const companies = await Company.find({
      _id: { $in: employers.map((e) => e.companyId).filter(Boolean) },
    }).select('name slug status verificationStatus');
    const companyMap = new Map(companies.map((c) => [c._id.toString(), c]));

    let items = employers
      .map((employer) => {
        const user = userMap.get(employer.userId.toString());
        if (!user) return null;
        if (query.search) {
          const q = query.search.toLowerCase();
          const company = employer.companyId
            ? companyMap.get(employer.companyId.toString())
            : null;
          const hay = `${user.name} ${user.email} ${user.phone ?? ''} ${company?.name ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return null;
        }
        return mapAdminEmployerResponse({
          employer,
          user,
          company: employer.companyId
            ? companyMap.get(employer.companyId.toString()) ?? null
            : null,
        });
      })
      .filter(Boolean);

    const total = items.length;
    const skip = (query.page - 1) * query.limit;
    items = items.slice(skip, skip + query.limit);

    return {
      employers: items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Employer not found', HTTP_STATUS.NOT_FOUND);
    }
    const employer = await Employer.findById(id);
    if (!employer) throw new AppError('Employer not found', HTTP_STATUS.NOT_FOUND);
    const user = await User.findById(employer.userId).select(
      'name email phone status lastLoginAt createdAt role',
    );
    if (!user || user.role !== 'employer') {
      throw new AppError('Employer not found', HTTP_STATUS.NOT_FOUND);
    }
    const company = employer.companyId
      ? await Company.findById(employer.companyId).select(
          'name slug status verificationStatus industry companySize',
        )
      : null;

    return {
      employer: mapAdminEmployerResponse({ employer, user, company }),
    };
  }

  async updateStatus(
    actor: AuthenticatedAdmin,
    id: string,
    input: AdminEmployerStatusInput,
  ) {
    const employer = await Employer.findById(id);
    if (!employer) throw new AppError('Employer not found', HTTP_STATUS.NOT_FOUND);
    const user = await User.findById(employer.userId);
    if (!user || user.role !== 'employer') {
      throw new AppError('Employer not found', HTTP_STATUS.NOT_FOUND);
    }

    const previousEmployer = employer.status;
    const previousUser = user.status;

    employer.status = input.status;
    await employer.save();

    const nextUserStatus = input.userStatus ?? (
      input.status === 'active' ? 'active' : input.status === 'suspended' ? 'suspended' : 'inactive'
    );
    user.status = nextUserStatus;
    await user.save();

    await writeAuditSafely({
      admin: actor,
      action:
        input.status === 'suspended'
          ? 'employer_suspended'
          : input.status === 'active'
            ? 'employer_activated'
            : 'employer_deactivated',
      entityType: 'employer',
      entityId: employer._id,
      metadata: {
        employerFrom: previousEmployer,
        employerTo: input.status,
        userFrom: previousUser,
        userTo: nextUserStatus,
      },
    });

    if (input.status === 'suspended' || input.status === 'inactive') {
      const userId = await resolveEmployerUserId(employer._id);
      if (userId) {
        await notifySafely({
          recipientId: userId,
          type: 'SYSTEM',
          title: 'Employer Account Updated',
          message:
            input.status === 'suspended'
              ? 'Your employer account has been suspended by an administrator.'
              : 'Your employer account has been deactivated by an administrator.',
          data: { status: input.status },
        });
      }
    }

    return this.getById(id);
  }
}

export const adminEmployerService = new AdminEmployerService();
