import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import type { VerificationStatus } from '../constants/enums';
import { Company } from '../models/Company';
import { Employer } from '../models/Employer';
import type { AuthenticatedAdmin } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { mapAdminCompanyResponse } from '../utils/adminManagementMapper';
import { writeAuditSafely } from './audit.service';
import { notifySafely, resolveEmployerUserId } from './notification.service';
import type {
  AdminCompanyListQuery,
  AdminCompanyStatusInput,
  AdminCompanyVerificationInput,
} from '../validators/adminManagement.validator';

function canTransitionVerification(
  from: VerificationStatus,
  to: VerificationStatus,
): boolean {
  if (from === to) return true;
  const allowed: Record<VerificationStatus, VerificationStatus[]> = {
    unverified: ['pending', 'verified', 'rejected'],
    pending: ['verified', 'rejected', 'unverified'],
    verified: ['rejected', 'pending'],
    rejected: ['pending', 'verified'],
  };
  return (allowed[from] ?? []).includes(to);
}

export class AdminCompanyService {
  async list(query: AdminCompanyListQuery) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.verificationStatus) filter.verificationStatus = query.verificationStatus;
    if (query.industry) {
      filter.industry = new RegExp(query.industry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    if (query.companySize) filter.companySize = query.companySize;
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) (filter.createdAt as Record<string, Date>).$gte = new Date(query.from);
      if (query.to) (filter.createdAt as Record<string, Date>).$lte = new Date(query.to);
    }
    if (query.search) {
      const q = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { slug: new RegExp(q, 'i') },
        { industry: new RegExp(q, 'i') },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const sort: Record<string, 1 | -1> = {
      [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1,
    };

    const [total, rows] = await Promise.all([
      Company.countDocuments(filter),
      Company.find(filter).sort(sort).skip(skip).limit(query.limit),
    ]);

    return {
      companies: rows.map((row) => mapAdminCompanyResponse(row)),
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
      throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);
    }
    const company = await Company.findById(id);
    if (!company) throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);

    const employers = await Employer.find({ companyId: company._id })
      .select('_id designation status verified userId')
      .limit(20);

    return {
      company: {
        ...mapAdminCompanyResponse(company),
        description: company.description ?? '',
        logo: company.logo ?? '',
        headquarters: company.headquarters ?? '',
        employers: employers.map((e) => ({
          id: e._id.toString(),
          userId: e.userId.toString(),
          designation: e.designation ?? '',
          status: e.status,
          verified: Boolean(e.verified),
        })),
      },
    };
  }

  async updateStatus(
    actor: AuthenticatedAdmin,
    id: string,
    input: AdminCompanyStatusInput,
  ) {
    const company = await Company.findById(id);
    if (!company) throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);

    const previous = company.status;
    company.status = input.status;
    await company.save();

    await writeAuditSafely({
      admin: actor,
      action: 'company_status_changed',
      entityType: 'company',
      entityId: company._id,
      metadata: { from: previous, to: input.status },
    });

    return this.getById(id);
  }

  async updateVerification(
    actor: AuthenticatedAdmin,
    id: string,
    input: AdminCompanyVerificationInput,
  ) {
    const company = await Company.findById(id);
    if (!company) throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);

    const next: VerificationStatus =
      input.action === 'approve'
        ? 'verified'
        : input.action === 'reject'
          ? 'rejected'
          : 'pending';

    const previous = company.verificationStatus as VerificationStatus;
    if (!canTransitionVerification(previous, next)) {
      throw new AppError(
        `Cannot transition verification from "${previous}" to "${next}"`,
        HTTP_STATUS.CONFLICT,
      );
    }

    company.verificationStatus = next;
    await company.save();

    const action =
      next === 'verified'
        ? 'company_verified'
        : next === 'rejected'
          ? 'company_rejected'
          : 'company_verification_pending';

    await writeAuditSafely({
      admin: actor,
      action,
      entityType: 'company',
      entityId: company._id,
      metadata: { from: previous, to: next, note: input.note ?? null },
    });

    const employer = await Employer.findOne({ companyId: company._id, status: 'active' }).select(
      '_id',
    );
    if (employer && (next === 'verified' || next === 'rejected')) {
      const userId = await resolveEmployerUserId(employer._id);
      if (userId) {
        await notifySafely({
          recipientId: userId,
          type: 'SYSTEM',
          title: next === 'verified' ? 'Company Verified' : 'Company Verification Rejected',
          message:
            next === 'verified'
              ? `Your company "${company.name}" has been verified.`
              : `Your company "${company.name}" verification was rejected.`,
          data: {
            companyId: company._id.toString(),
            verificationStatus: next,
          },
        });
      }
    }

    return this.getById(id);
  }
}

export const adminCompanyService = new AdminCompanyService();
