import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import type { JobStatus } from '../constants/enums';
import { Company } from '../models/Company';
import { Job } from '../models/Job';
import type { AuthenticatedAdmin } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { assertAdminJobTransition } from '../utils/jobStatus';
import { mapEmployerJob } from '../utils/jobMapper';
import { writeAuditSafely } from './audit.service';
import { notifySafely, resolveEmployerUserId } from './notification.service';
import { findCurrentCompanySubscription, FREE_ENTITLEMENTS, isSubscriptionCurrentlyActive } from './entitlement.service';
import { resolveJobExpiresAt } from '../utils/jobListingExpiry';
import type {
  AdminJobFlagInput,
  AdminJobListQuery,
  AdminJobStatusInput,
} from '../validators/adminManagement.validator';

export class AdminJobModerationService {
  async list(query: AdminJobListQuery) {
    const filter: Record<string, unknown> = { deletedAt: null };
    if (query.status) filter.status = query.status;
    if (query.categoryId) filter.categoryId = new mongoose.Types.ObjectId(query.categoryId);
    if (query.employerId) filter.employerId = new mongoose.Types.ObjectId(query.employerId);
    if (query.companyId) filter.companyId = new mongoose.Types.ObjectId(query.companyId);
    if (query.locationId) {
      filter['location.locationId'] = new mongoose.Types.ObjectId(query.locationId);
    }
    if (query.featured !== undefined) filter.featured = query.featured;
    if (query.urgent !== undefined) filter.urgent = query.urgent;
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) (filter.createdAt as Record<string, Date>).$gte = new Date(query.from);
      if (query.to) (filter.createdAt as Record<string, Date>).$lte = new Date(query.to);
    }
    if (query.search) {
      const q = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title: new RegExp(q, 'i') },
        { slug: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const sort: Record<string, 1 | -1> = {
      [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1,
    };

    const [total, rows] = await Promise.all([
      Job.countDocuments(filter),
      Job.find(filter).sort(sort).skip(skip).limit(query.limit),
    ]);

    const companies = await Company.find({
      _id: { $in: rows.map((r) => r.companyId) },
    }).select('name slug status verificationStatus');
    const companyMap = new Map(companies.map((c) => [c._id.toString(), c]));

    return {
      jobs: rows.map((job) => {
        const company = companyMap.get(job.companyId.toString());
        return {
          id: job._id.toString(),
          title: job.title,
          slug: job.slug,
          status: job.status,
          featured: Boolean(job.featured),
          urgent: Boolean(job.urgent),
          views: job.views ?? 0,
          applicationsCount: job.applicationsCount ?? 0,
          companyId: job.companyId.toString(),
          employerId: job.employerId.toString(),
          categoryId: job.categoryId ? job.categoryId.toString() : null,
          company: company
            ? {
                id: company._id.toString(),
                name: company.name,
                slug: company.slug,
                status: company.status,
              }
            : null,
          publishedAt: job.publishedAt ?? null,
          createdAt: job.createdAt ?? null,
          updatedAt: job.updatedAt ?? null,
        };
      }),
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
      throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
    }
    const job = await Job.findOne({ _id: id, deletedAt: null });
    if (!job) throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
    const company = await Company.findById(job.companyId).select(
      'name slug status verificationStatus logo industry',
    );
    return {
      job: mapEmployerJob(job, {
        category: null,
        company: company
          ? {
              id: company._id.toString(),
              name: company.name,
              slug: company.slug,
              logo: company.logo ?? '',
              industry: company.industry ?? '',
              companySize: null,
              headquarters: '',
              verificationStatus: company.verificationStatus,
            }
          : null,
      }),
    };
  }

  async updateStatus(
    actor: AuthenticatedAdmin,
    id: string,
    input: AdminJobStatusInput,
  ) {
    const job = await Job.findOne({ _id: id, deletedAt: null });
    if (!job) throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);

    const from = job.status as JobStatus;
    const to = input.status as JobStatus;
    assertAdminJobTransition(from, to);

    if (to === 'published') {
      const company = await Company.findById(job.companyId).select('status');
      if (!company || company.status === 'suspended') {
        throw new AppError('Cannot publish job for a suspended company', HTTP_STATUS.CONFLICT);
      }
      const publishedAt = job.publishedAt ?? new Date();
      job.publishedAt = publishedAt;

      const subscription = await findCurrentCompanySubscription(job.companyId.toString());
      let lifetimeDays = FREE_ENTITLEMENTS.limits.jobListingLifetimeDays;
      if (subscription && isSubscriptionCurrentlyActive(subscription)) {
        const snap = Number(
          (subscription.limits as { jobListingLifetimeDays?: number } | undefined)
            ?.jobListingLifetimeDays ?? 0,
        );
        if (snap > 0) {
          lifetimeDays = snap;
        } else if (subscription.plan !== 'free' && Number(subscription.amount ?? 0) > 0) {
          lifetimeDays = 0;
        }
      }

      job.expiresAt = resolveJobExpiresAt({
        publishedAt,
        applicationDeadline: job.applicationDeadline,
        jobListingLifetimeDays: lifetimeDays,
      });
    }

    job.status = to;
    await job.save();

    const auditAction =
      to === 'published'
        ? 'job_approved'
        : to === 'rejected'
          ? 'job_rejected'
          : to === 'closed'
            ? 'job_closed'
            : to === 'paused'
              ? 'job_paused'
              : 'job_status_changed';

    await writeAuditSafely({
      admin: actor,
      action: auditAction,
      entityType: 'job',
      entityId: job._id,
      metadata: { from, to, reason: input.reason ?? null },
    });

    if (to === 'published' || to === 'rejected' || to === 'closed' || to === 'paused') {
      const employerUserId = await resolveEmployerUserId(job.employerId);
      if (employerUserId) {
        await notifySafely({
          recipientId: employerUserId,
          type: 'JOB_STATUS_CHANGED',
          title: 'Job Status Updated',
          message: `Your job "${job.title}" is now ${to}.`,
          data: { jobId: job._id.toString(), status: to },
        });
      }
    }

    return this.getById(id);
  }

  async updateFeatured(actor: AuthenticatedAdmin, id: string, featured: boolean) {
    return this.updateFlags(actor, id, { featured });
  }

  async updateUrgent(actor: AuthenticatedAdmin, id: string, urgent: boolean) {
    return this.updateFlags(actor, id, { urgent });
  }

  async updateFlags(actor: AuthenticatedAdmin, id: string, input: AdminJobFlagInput) {
    const job = await Job.findOne({ _id: id, deletedAt: null });
    if (!job) throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);

    const previous = { featured: Boolean(job.featured), urgent: Boolean(job.urgent) };
    if (input.featured !== undefined) job.featured = input.featured;
    if (input.urgent !== undefined) job.urgent = input.urgent;
    await job.save();

    // Administrative override — does not mutate subscription entitlement usage.
    await writeAuditSafely({
      admin: actor,
      action: 'job_flags_updated',
      entityType: 'job',
      entityId: job._id,
      metadata: {
        previous,
        next: { featured: Boolean(job.featured), urgent: Boolean(job.urgent) },
        adminOverride: true,
        note: 'Admin flag change does not alter subscription balances',
      },
    });

    return this.getById(id);
  }
}

export const adminJobModerationService = new AdminJobModerationService();
