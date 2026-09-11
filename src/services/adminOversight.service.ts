import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import { Application } from '../models/Application';
import { Candidate } from '../models/Candidate';
import { Company } from '../models/Company';
import { Interview } from '../models/Interview';
import { Job } from '../models/Job';
import { User } from '../models/User';
import { AdminAuditLog } from '../models/AdminAuditLog';
import { AppError } from '../utils/AppError';
import { mapAuditLog } from './audit.service';
import type {
  AdminApplicationListQuery,
  AdminAuditListQuery,
  AdminInterviewListQuery,
} from '../validators/adminManagement.validator';

export class AdminOversightService {
  async listApplications(query: AdminApplicationListQuery) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.jobId) filter.jobId = new mongoose.Types.ObjectId(query.jobId);
    if (query.candidateId) filter.candidateId = new mongoose.Types.ObjectId(query.candidateId);
    if (query.employerId) filter.employerId = new mongoose.Types.ObjectId(query.employerId);
    if (query.companyId) filter.companyId = new mongoose.Types.ObjectId(query.companyId);
    if (query.from || query.to) {
      filter.appliedAt = {};
      if (query.from) (filter.appliedAt as Record<string, Date>).$gte = new Date(query.from);
      if (query.to) (filter.appliedAt as Record<string, Date>).$lte = new Date(query.to);
    }

    const skip = (query.page - 1) * query.limit;
    const sort: Record<string, 1 | -1> = {
      [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1,
    };

    const [total, rows] = await Promise.all([
      Application.countDocuments(filter),
      Application.find(filter).sort(sort).skip(skip).limit(query.limit),
    ]);

    const jobs = await Job.find({ _id: { $in: rows.map((r) => r.jobId) } }).select(
      'title slug status',
    );
    const jobMap = new Map(jobs.map((j) => [j._id.toString(), j]));
    const companies = await Company.find({
      _id: { $in: rows.map((r) => r.companyId) },
    }).select('name slug');
    const companyMap = new Map(companies.map((c) => [c._id.toString(), c]));
    const candidates = await Candidate.find({
      _id: { $in: rows.map((r) => r.candidateId) },
    }).select('userId headline');
    const users = await User.find({
      _id: { $in: candidates.map((c) => c.userId) },
    }).select('name email');
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));
    const candidateMap = new Map(
      candidates.map((c) => [
        c._id.toString(),
        {
          id: c._id.toString(),
          headline: c.headline ?? '',
          name: userMap.get(c.userId.toString())?.name ?? null,
          email: userMap.get(c.userId.toString())?.email ?? null,
        },
      ]),
    );

    return {
      applications: rows.map((row) => {
        const job = jobMap.get(row.jobId.toString());
        const company = companyMap.get(row.companyId.toString());
        return {
          id: row._id.toString(),
          status: row.status,
          appliedAt: row.appliedAt ?? row.createdAt ?? null,
          job: job
            ? { id: job._id.toString(), title: job.title, slug: job.slug, status: job.status }
            : null,
          company: company
            ? { id: company._id.toString(), name: company.name, slug: company.slug }
            : null,
          candidate: candidateMap.get(row.candidateId.toString()) ?? {
            id: row.candidateId.toString(),
          },
          employerId: row.employerId.toString(),
          companyId: row.companyId.toString(),
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

  async getApplicationById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }
    const application = await Application.findById(id);
    if (!application) throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);

    const [job, company, candidate] = await Promise.all([
      Job.findById(application.jobId).select('title slug status companyId employerId'),
      Company.findById(application.companyId).select('name slug status'),
      Candidate.findById(application.candidateId).select('userId headline profileCompletion'),
    ]);
    const user = candidate
      ? await User.findById(candidate.userId).select('name email phone status')
      : null;

    return {
      application: {
        id: application._id.toString(),
        status: application.status,
        coverLetter: application.coverLetter ?? '',
        resume: application.resume ? '[provided]' : '',
        hasResume: Boolean(application.resume?.trim()),
        source: application.source ?? '',
        appliedAt: application.appliedAt ?? null,
        createdAt: application.createdAt ?? null,
        updatedAt: application.updatedAt ?? null,
        job: job
          ? {
              id: job._id.toString(),
              title: job.title,
              slug: job.slug,
              status: job.status,
            }
          : null,
        company: company
          ? {
              id: company._id.toString(),
              name: company.name,
              slug: company.slug,
              status: company.status,
            }
          : null,
        candidate: candidate
          ? {
              id: candidate._id.toString(),
              headline: candidate.headline ?? '',
              profileCompletion: candidate.profileCompletion ?? 0,
              name: user?.name ?? null,
              email: user?.email ?? null,
              phone: user?.phone ?? '',
              status: user?.status ?? null,
            }
          : null,
        employerId: application.employerId.toString(),
      },
    };
  }

  async listInterviews(query: AdminInterviewListQuery) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.jobId) filter.jobId = new mongoose.Types.ObjectId(query.jobId);
    if (query.candidateId) filter.candidateId = new mongoose.Types.ObjectId(query.candidateId);
    if (query.employerId) filter.employerId = new mongoose.Types.ObjectId(query.employerId);
    if (query.companyId) filter.companyId = new mongoose.Types.ObjectId(query.companyId);
    if (query.from || query.to) {
      filter.scheduledAt = {};
      if (query.from) (filter.scheduledAt as Record<string, Date>).$gte = new Date(query.from);
      if (query.to) (filter.scheduledAt as Record<string, Date>).$lte = new Date(query.to);
    }

    const skip = (query.page - 1) * query.limit;
    const sort: Record<string, 1 | -1> = {
      [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1,
    };

    const [total, rows] = await Promise.all([
      Interview.countDocuments(filter),
      Interview.find(filter).sort(sort).skip(skip).limit(query.limit),
    ]);

    const jobs = await Job.find({ _id: { $in: rows.map((r) => r.jobId) } }).select('title slug');
    const jobMap = new Map(jobs.map((j) => [j._id.toString(), j]));
    const companies = await Company.find({
      _id: { $in: rows.map((r) => r.companyId) },
    }).select('name slug');
    const companyMap = new Map(companies.map((c) => [c._id.toString(), c]));

    return {
      interviews: rows.map((row) => ({
        id: row._id.toString(),
        status: row.status,
        type: row.type,
        scheduledAt: row.scheduledAt,
        duration: row.duration ?? null,
        applicationId: row.applicationId.toString(),
        jobId: row.jobId.toString(),
        candidateId: row.candidateId.toString(),
        employerId: row.employerId.toString(),
        companyId: row.companyId.toString(),
        job: jobMap.get(row.jobId.toString())
          ? {
              id: row.jobId.toString(),
              title: jobMap.get(row.jobId.toString())!.title,
              slug: jobMap.get(row.jobId.toString())!.slug,
            }
          : null,
        company: companyMap.get(row.companyId.toString())
          ? {
              id: row.companyId.toString(),
              name: companyMap.get(row.companyId.toString())!.name,
              slug: companyMap.get(row.companyId.toString())!.slug,
            }
          : null,
        createdAt: row.createdAt ?? null,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getInterviewById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Interview not found', HTTP_STATUS.NOT_FOUND);
    }
    const interview = await Interview.findById(id);
    if (!interview) throw new AppError('Interview not found', HTTP_STATUS.NOT_FOUND);

    const [job, company, candidate] = await Promise.all([
      Job.findById(interview.jobId).select('title slug status'),
      Company.findById(interview.companyId).select('name slug'),
      Candidate.findById(interview.candidateId).select('userId headline'),
    ]);
    const user = candidate
      ? await User.findById(candidate.userId).select('name email')
      : null;

    return {
      interview: {
        id: interview._id.toString(),
        status: interview.status,
        type: interview.type,
        scheduledAt: interview.scheduledAt,
        duration: interview.duration ?? null,
        location: interview.location ?? '',
        meetingLink: interview.meetingLink ? '[set]' : '',
        hasMeetingLink: Boolean(interview.meetingLink?.trim()),
        interviewer: interview.interviewer ?? '',
        notes: interview.notes ?? '',
        applicationId: interview.applicationId.toString(),
        job: job
          ? { id: job._id.toString(), title: job.title, slug: job.slug, status: job.status }
          : null,
        company: company
          ? { id: company._id.toString(), name: company.name, slug: company.slug }
          : null,
        candidate: candidate
          ? {
              id: candidate._id.toString(),
              headline: candidate.headline ?? '',
              name: user?.name ?? null,
              email: user?.email ?? null,
            }
          : null,
        employerId: interview.employerId.toString(),
        createdAt: interview.createdAt ?? null,
        updatedAt: interview.updatedAt ?? null,
      },
    };
  }

  async listAuditLogs(query: AdminAuditListQuery) {
    const filter: Record<string, unknown> = {};
    if (query.action) filter.action = query.action;
    if (query.entityType) filter.entityType = query.entityType;
    if (query.entityId) filter.entityId = new mongoose.Types.ObjectId(query.entityId);
    if (query.adminUserId) filter.adminUserId = new mongoose.Types.ObjectId(query.adminUserId);
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) (filter.createdAt as Record<string, Date>).$gte = new Date(query.from);
      if (query.to) (filter.createdAt as Record<string, Date>).$lte = new Date(query.to);
    }

    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      AdminAuditLog.countDocuments(filter),
      AdminAuditLog.find(filter)
        .sort({ createdAt: query.sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(query.limit),
    ]);

    return {
      auditLogs: rows.map((row) => mapAuditLog(row)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getAuditLogById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Audit log not found', HTTP_STATUS.NOT_FOUND);
    }
    const log = await AdminAuditLog.findById(id);
    if (!log) throw new AppError('Audit log not found', HTTP_STATUS.NOT_FOUND);
    return { auditLog: mapAuditLog(log) };
  }
}

export const adminOversightService = new AdminOversightService();
