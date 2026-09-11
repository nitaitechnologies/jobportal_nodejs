import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import type { ReportStatus, ReportTargetType } from '../constants/enums';
import { AdminUser } from '../models/AdminUser';
import { Candidate } from '../models/Candidate';
import { Company } from '../models/Company';
import { Employer } from '../models/Employer';
import { Job } from '../models/Job';
import { Report } from '../models/Report';
import { User } from '../models/User';
import type { AuthenticatedAdmin } from '../types/auth.types';
import { isCompanyPubliclyVisible } from '../utils/companyMapper';
import { isJobPubliclyVisible } from '../utils/jobVisibility';
import { AppError } from '../utils/AppError';
import { mapAdminReport, mapUserReport } from '../utils/reportMapper';
import {
  ACTIVE_REPORT_STATUSES,
  canTransitionReportStatus,
} from '../utils/reportStatus';
import { notifySafely } from './notification.service';
import { trackSafely } from './analytics.service';
import type {
  AdminReportQuery,
  ReportAdminUpdateInput,
  ReportCreateInput,
  UserReportQuery,
} from '../validators/report.validator';

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

async function loadReporterContext(userId: string) {
  const user = await User.findById(userId).select('name email role status');
  if (!user || user.status !== 'active' || (user.role !== 'candidate' && user.role !== 'employer')) {
    throw new AppError('Access denied', HTTP_STATUS.FORBIDDEN);
  }

  const [candidate, employer] = await Promise.all([
    user.role === 'candidate'
      ? Candidate.findOne({ userId: user._id }).select('_id')
      : Promise.resolve(null),
    user.role === 'employer'
      ? Employer.findOne({ userId: user._id }).select('_id companyId')
      : Promise.resolve(null),
  ]);

  return {
    user,
    candidateId: candidate?._id?.toString() ?? null,
    employerId: employer?._id?.toString() ?? null,
    companyId: employer?.companyId?.toString() ?? null,
  };
}

async function assertReportableTarget(
  targetType: ReportTargetType,
  targetId: string,
  reporter: Awaited<ReturnType<typeof loadReporterContext>>,
): Promise<Record<string, unknown>> {
  const id = new mongoose.Types.ObjectId(targetId);

  if (targetType === 'job') {
    const job = await Job.findById(id).select(
      'title slug status companyId employerId deletedAt expiresAt',
    );
    if (!job || job.deletedAt) {
      throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
    }
    if (reporter.employerId && job.employerId.toString() === reporter.employerId) {
      throw new AppError('You cannot report your own job', HTTP_STATUS.BAD_REQUEST);
    }
    const company = await Company.findById(job.companyId).select('status verificationStatus');
    if (!isJobPubliclyVisible(job, company)) {
      throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
    }
    return {
      type: 'job',
      id: job._id.toString(),
      title: job.title,
      slug: job.slug,
      status: job.status,
    };
  }

  if (targetType === 'company') {
    const company = await Company.findById(id).select(
      'name slug status verificationStatus',
    );
    if (!company || !isCompanyPubliclyVisible(company)) {
      throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);
    }
    if (reporter.companyId && company._id.toString() === reporter.companyId) {
      throw new AppError('You cannot report your own company', HTTP_STATUS.BAD_REQUEST);
    }
    return {
      type: 'company',
      id: company._id.toString(),
      name: company.name,
      slug: company.slug,
      status: company.status,
      verificationStatus: company.verificationStatus,
    };
  }

  if (targetType === 'user') {
    if (targetId === reporter.user._id.toString()) {
      throw new AppError('You cannot report your own account', HTTP_STATUS.BAD_REQUEST);
    }
    const user = await User.findById(id).select('name role status deletedAt');
    if (!user || user.deletedAt || user.status === 'deleted') {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }
    return {
      type: 'user',
      id: user._id.toString(),
      name: user.name,
      role: user.role,
      status: user.status,
    };
  }

  if (targetType === 'employer') {
    const employer = await Employer.findById(id).select('userId companyId status');
    if (!employer) {
      throw new AppError('Employer not found', HTTP_STATUS.NOT_FOUND);
    }
    if (reporter.employerId && employer._id.toString() === reporter.employerId) {
      throw new AppError('You cannot report your own employer profile', HTTP_STATUS.BAD_REQUEST);
    }
    const [user, company] = await Promise.all([
      User.findById(employer.userId).select('name status'),
      Company.findById(employer.companyId).select('name slug status'),
    ]);
    return {
      type: 'employer',
      id: employer._id.toString(),
      status: employer.status,
      user: user ? { id: user._id.toString(), name: user.name, status: user.status } : null,
      company: company
        ? { id: company._id.toString(), name: company.name, slug: company.slug, status: company.status }
        : null,
    };
  }

  // candidate
  const candidate = await Candidate.findById(id).select('userId headline currentJobTitle');
  if (!candidate) {
    throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
  }
  if (reporter.candidateId && candidate._id.toString() === reporter.candidateId) {
    throw new AppError('You cannot report your own candidate profile', HTTP_STATUS.BAD_REQUEST);
  }
  const user = await User.findById(candidate.userId).select('name status');
  return {
    type: 'candidate',
    id: candidate._id.toString(),
    headline: candidate.headline ?? '',
    currentJobTitle: candidate.currentJobTitle ?? '',
    user: user ? { id: user._id.toString(), name: user.name, status: user.status } : null,
  };
}

async function loadTargetSummary(
  targetType: ReportTargetType,
  targetId: mongoose.Types.ObjectId,
): Promise<Record<string, unknown> | null> {
  if (targetType === 'job') {
    const job = await Job.findById(targetId).select('title slug status companyId');
    if (!job) return null;
    const company = await Company.findById(job.companyId).select('name slug');
    return {
      type: 'job',
      id: job._id.toString(),
      title: job.title,
      slug: job.slug,
      status: job.status,
      company: company
        ? { id: company._id.toString(), name: company.name, slug: company.slug }
        : null,
    };
  }
  if (targetType === 'company') {
    const company = await Company.findById(targetId).select(
      'name slug status verificationStatus',
    );
    if (!company) return null;
    return {
      type: 'company',
      id: company._id.toString(),
      name: company.name,
      slug: company.slug,
      status: company.status,
      verificationStatus: company.verificationStatus,
    };
  }
  if (targetType === 'user') {
    const user = await User.findById(targetId).select('name role status');
    if (!user) return null;
    return {
      type: 'user',
      id: user._id.toString(),
      name: user.name,
      role: user.role,
      status: user.status,
    };
  }
  if (targetType === 'employer') {
    const employer = await Employer.findById(targetId).select('userId companyId status');
    if (!employer) return null;
    const [user, company] = await Promise.all([
      User.findById(employer.userId).select('name status'),
      Company.findById(employer.companyId).select('name slug status'),
    ]);
    return {
      type: 'employer',
      id: employer._id.toString(),
      status: employer.status,
      user: user ? { id: user._id.toString(), name: user.name, status: user.status } : null,
      company: company
        ? { id: company._id.toString(), name: company.name, slug: company.slug, status: company.status }
        : null,
    };
  }
  const candidate = await Candidate.findById(targetId).select('userId headline');
  if (!candidate) return null;
  const user = await User.findById(candidate.userId).select('name status');
  return {
    type: 'candidate',
    id: candidate._id.toString(),
    headline: candidate.headline ?? '',
    user: user ? { id: user._id.toString(), name: user.name, status: user.status } : null,
  };
}

async function loadSafeUserSummary(userId?: mongoose.Types.ObjectId | string | null) {
  if (!userId) {
    return null;
  }
  const user = await User.findById(userId).select('name email role status');
  if (!user) {
    return null;
  }
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

async function assertAssignableAdmin(userId: string): Promise<void> {
  const [user, admin] = await Promise.all([
    User.findById(userId).select('role status deletedAt'),
    AdminUser.findOne({ userId }),
  ]);
  if (!user || user.role !== 'admin' || user.status !== 'active' || user.deletedAt) {
    throw new AppError('reviewedBy must be an active admin user', HTTP_STATUS.BAD_REQUEST);
  }
  if (!admin || admin.status !== 'active') {
    throw new AppError('reviewedBy must be an active admin user', HTTP_STATUS.BAD_REQUEST);
  }
}

export class ReportService {
  async create(userId: string, input: ReportCreateInput) {
    const reporter = await loadReporterContext(userId);
    await assertReportableTarget(input.targetType, input.targetId, reporter);

    try {
      const report = await Report.create({
        reporterId: reporter.user._id,
        targetType: input.targetType,
        targetId: new mongoose.Types.ObjectId(input.targetId),
        reason: input.reason,
        description: input.description,
        status: 'pending',
      });

      await trackSafely({
        eventType: 'report_created',
        userId: reporter.user._id,
        actorRole:
          reporter.user.role === 'candidate'
            ? 'candidate'
            : reporter.user.role === 'employer'
              ? 'employer'
              : 'admin',
        entityType: 'report',
        entityId: report._id,
        metadata: {
          targetType: input.targetType,
          targetId: input.targetId,
          reason: input.reason,
        },
      });

      return { report: mapUserReport(report) };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AppError(
          'You already have an active report for this target',
          HTTP_STATUS.CONFLICT,
        );
      }
      throw error;
    }
  }

  async listMine(userId: string, query: UserReportQuery) {
    const filter: Record<string, unknown> = {
      reporterId: new mongoose.Types.ObjectId(userId),
    };
    if (query.status) {
      filter.status = query.status;
    }
    if (query.targetType) {
      filter.targetType = query.targetType;
    }

    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      Report.countDocuments(filter),
      Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    ]);

    return {
      reports: rows.map((row) => mapUserReport(row)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getMineById(userId: string, id: string) {
    const report = await Report.findOne({
      _id: id,
      reporterId: userId,
    });
    if (!report) {
      throw new AppError('Report not found', HTTP_STATUS.NOT_FOUND);
    }
    return { report: mapUserReport(report) };
  }

  async listAdmin(query: AdminReportQuery) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.targetType) filter.targetType = query.targetType;
    if (query.reason) filter.reason = query.reason;

    const sort =
      query.sort === 'oldest' ? { createdAt: 1 as const } : { createdAt: -1 as const };
    const skip = (query.page - 1) * query.limit;

    const [total, rows] = await Promise.all([
      Report.countDocuments(filter),
      Report.find(filter).sort(sort).skip(skip).limit(query.limit),
    ]);

    const reports = await Promise.all(
      rows.map(async (row) =>
        mapAdminReport(row, {
          reporter: await loadSafeUserSummary(row.reporterId),
          target: await loadTargetSummary(row.targetType as ReportTargetType, row.targetId),
          reviewer: await loadSafeUserSummary(row.reviewedBy),
        }),
      ),
    );

    return {
      reports,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getAdminById(id: string) {
    const report = await Report.findById(id);
    if (!report) {
      throw new AppError('Report not found', HTTP_STATUS.NOT_FOUND);
    }

    return {
      report: mapAdminReport(report, {
        reporter: await loadSafeUserSummary(report.reporterId),
        target: await loadTargetSummary(
          report.targetType as ReportTargetType,
          report.targetId,
        ),
        reviewer: await loadSafeUserSummary(report.reviewedBy),
      }),
    };
  }

  async updateAdmin(admin: AuthenticatedAdmin, id: string, input: ReportAdminUpdateInput) {
    const report = await Report.findById(id);
    if (!report) {
      throw new AppError('Report not found', HTTP_STATUS.NOT_FOUND);
    }

    const previousStatus = report.status as ReportStatus;

    if (input.status !== undefined) {
      const next = input.status as ReportStatus;
      if (!canTransitionReportStatus(previousStatus, next)) {
        throw new AppError(
          `Cannot transition report from "${previousStatus}" to "${next}"`,
          HTTP_STATUS.CONFLICT,
        );
      }
      report.status = next;
      if (next !== previousStatus) {
        report.reviewedBy = new mongoose.Types.ObjectId(admin.userId);
        report.reviewedAt = new Date();
      }
    }

    if (input.resolution !== undefined) {
      report.resolution = input.resolution;
    }

    if (input.reviewedBy !== undefined) {
      if (input.reviewedBy === null) {
        report.reviewedBy = undefined;
      } else {
        await assertAssignableAdmin(input.reviewedBy);
        report.reviewedBy = new mongoose.Types.ObjectId(input.reviewedBy);
        if (!report.reviewedAt) {
          report.reviewedAt = new Date();
        }
      }
    }

    // Ensure terminal updates always stamp reviewer when moving into review/resolve.
    if (
      input.status &&
      ACTIVE_REPORT_STATUSES.includes(previousStatus) &&
      (input.status === 'reviewing' ||
        input.status === 'resolved' ||
        input.status === 'dismissed') &&
      !report.reviewedBy
    ) {
      report.reviewedBy = new mongoose.Types.ObjectId(admin.userId);
      report.reviewedAt = new Date();
    }

    await report.save();

    if (
      input.status &&
      input.status !== previousStatus &&
      input.status === 'resolved'
    ) {
      await trackSafely({
        eventType: 'report_resolved',
        userId: admin.userId,
        actorRole: 'admin',
        entityType: 'report',
        entityId: report._id,
        metadata: {
          targetType: report.targetType,
          previousStatus,
          status: input.status,
        },
      });
    }

    if (
      input.status &&
      input.status !== previousStatus &&
      (input.status === 'resolved' || input.status === 'dismissed')
    ) {
      await notifySafely({
        recipientId: report.reporterId.toString(),
        type: 'REPORT_STATUS_CHANGED',
        title: input.status === 'resolved' ? 'Report Resolved' : 'Report Dismissed',
        message:
          input.status === 'resolved'
            ? 'Your safety report has been resolved.'
            : 'Your safety report has been dismissed after review.',
        data: {
          reportId: report._id.toString(),
          status: input.status,
          targetType: report.targetType,
        },
      });
    }

    return this.getAdminById(id);
  }
}

export const reportService = new ReportService();
