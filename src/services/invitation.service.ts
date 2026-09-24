import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import type { InvitationStatus } from '../constants/enums';
import { Application } from '../models/Application';
import { Candidate } from '../models/Candidate';
import { Company } from '../models/Company';
import { Job } from '../models/Job';
import { JobInvitation } from '../models/JobInvitation';
import { User } from '../models/User';
import type { AuthenticatedCandidate, AuthenticatedEmployer } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { mapInvitation } from '../utils/invitationMapper';
import { isJobPubliclyVisible } from '../utils/jobVisibility';
import {
  notifySafely,
  resolveCandidateUserId,
  resolveEmployerUserId,
} from './notification.service';
import { applicationService } from './application.service';
import type {
  InvitationCreateInput,
  InvitationQuery,
} from '../validators/invitation.validator';

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

async function expireIfNeeded(invitation: {
  status: string;
  expiresAt?: Date | null;
  save: () => Promise<unknown>;
}): Promise<boolean> {
  if (
    invitation.status === 'pending' &&
    invitation.expiresAt &&
    invitation.expiresAt.getTime() <= Date.now()
  ) {
    invitation.status = 'expired';
    await invitation.save();
    return true;
  }
  return false;
}

async function loadJobCompany(jobId: mongoose.Types.ObjectId) {
  const job = await Job.findById(jobId).select(
    'title slug status workMode employmentType companyId employerId applicationMethod applicationDeadline',
  );
  if (!job) return { job: null, company: null };
  const company = await Company.findById(job.companyId).select(
    'name slug logo industry status verificationStatus',
  );
  return {
    job: {
      id: job._id.toString(),
      title: job.title,
      slug: job.slug,
      status: job.status,
      workMode: job.workMode,
      employmentType: job.employmentType,
    },
    company: company
      ? {
          id: company._id.toString(),
          name: company.name,
          slug: company.slug,
          logo: company.logo ?? '',
          industry: company.industry ?? '',
        }
      : null,
    jobDoc: job,
    companyDoc: company,
  };
}

async function loadCandidateSummary(candidateId: mongoose.Types.ObjectId) {
  const candidate = await Candidate.findById(candidateId).select(
    'headline currentJobTitle currentLocation skills userId',
  );
  if (!candidate) return null;
  const user = await User.findById(candidate.userId).select('name');
  return {
    id: candidate._id.toString(),
    name: user?.name ?? '',
    headline: candidate.headline ?? '',
    currentJobTitle: candidate.currentJobTitle ?? '',
    currentLocation: candidate.currentLocation ?? '',
    skills: (candidate.skills ?? []).slice(0, 12),
  };
}

export class InvitationService {
  async create(employer: AuthenticatedEmployer, input: InvitationCreateInput) {
    const job = await Job.findOne({
      _id: input.jobId,
      employerId: employer.employerId,
      companyId: employer.companyId,
      deletedAt: null,
    });
    if (!job) {
      throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
    }

    const company = await Company.findById(job.companyId).select(
      'status verificationStatus name slug logo industry',
    );
    if (!isJobPubliclyVisible(job, company)) {
      throw new AppError('Job is not available for invitations', HTTP_STATUS.BAD_REQUEST);
    }
    if (job.applicationMethod && job.applicationMethod !== 'platform') {
      throw new AppError(
        'Invitations are only supported for platform applications',
        HTTP_STATUS.BAD_REQUEST,
      );
    }
    if (job.applicationDeadline && job.applicationDeadline.getTime() <= Date.now()) {
      throw new AppError('Application deadline has passed', HTTP_STATUS.BAD_REQUEST);
    }

    const candidate = await Candidate.findOne({
      _id: input.candidateId,
      profileVisibility: { $in: ['public', 'employers_only'] },
    });
    if (!candidate) {
      throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);
    }

    const existingApp = await Application.findOne({
      candidateId: candidate._id,
      jobId: job._id,
    }).select('_id status');
    if (existingApp && existingApp.status !== 'withdrawn') {
      throw new AppError(
        'Candidate has already applied to this job',
        HTTP_STATUS.CONFLICT,
      );
    }

    try {
      const invitation = await JobInvitation.create({
        candidateId: candidate._id,
        jobId: job._id,
        employerId: new mongoose.Types.ObjectId(employer.employerId),
        companyId: new mongoose.Types.ObjectId(employer.companyId),
        message: input.message ?? '',
        status: 'pending',
        expiresAt: input.expiresAt,
      });

      const candidateUserId = await resolveCandidateUserId(candidate._id);
      if (candidateUserId) {
        await notifySafely({
          recipientId: candidateUserId,
          type: 'RECRUITER_INVITATION',
          title: 'Job Invitation',
          message: `You have been invited to apply for "${job.title}".`,
          data: {
            invitationId: invitation._id.toString(),
            jobId: job._id.toString(),
            employerId: employer.employerId,
            candidateId: candidate._id.toString(),
            companyId: employer.companyId,
          },
        });
      }

      return {
        invitation: mapInvitation(invitation, {
          job: {
            id: job._id.toString(),
            title: job.title,
            slug: job.slug,
            status: job.status,
            workMode: job.workMode,
            employmentType: job.employmentType,
          },
          company: company
            ? {
                id: company._id.toString(),
                name: company.name,
                slug: company.slug,
                logo: company.logo ?? '',
                industry: company.industry ?? '',
              }
            : null,
          candidate: await loadCandidateSummary(candidate._id),
        }),
      };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AppError(
          'A pending invitation already exists for this candidate and job',
          HTTP_STATUS.CONFLICT,
        );
      }
      throw error;
    }
  }

  async listEmployer(employer: AuthenticatedEmployer, query: InvitationQuery) {
    const filter: Record<string, unknown> = {
      employerId: new mongoose.Types.ObjectId(employer.employerId),
      companyId: new mongoose.Types.ObjectId(employer.companyId),
    };
    if (query.status) filter.status = query.status;
    if (query.jobId) filter.jobId = new mongoose.Types.ObjectId(query.jobId);

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      JobInvitation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
      JobInvitation.countDocuments(filter),
    ]);

    const invitations = await Promise.all(
      items.map(async (item) => {
        await expireIfNeeded(item);
        const extras = await loadJobCompany(item.jobId);
        return mapInvitation(item, {
          job: extras.job,
          company: extras.company,
          candidate: await loadCandidateSummary(item.candidateId),
        });
      }),
    );

    return {
      invitations,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async listCandidate(candidate: AuthenticatedCandidate, query: InvitationQuery) {
    const filter: Record<string, unknown> = {
      candidateId: new mongoose.Types.ObjectId(candidate.candidateId),
    };
    if (query.status) filter.status = query.status;
    if (query.jobId) filter.jobId = new mongoose.Types.ObjectId(query.jobId);

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      JobInvitation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
      JobInvitation.countDocuments(filter),
    ]);

    const invitations = await Promise.all(
      items.map(async (item) => {
        await expireIfNeeded(item);
        const extras = await loadJobCompany(item.jobId);
        return mapInvitation(item, {
          job: extras.job,
          company: extras.company,
        });
      }),
    );

    return {
      invitations,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async getCandidateById(candidate: AuthenticatedCandidate, id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invitation not found', HTTP_STATUS.NOT_FOUND);
    }
    const invitation = await JobInvitation.findOne({
      _id: id,
      candidateId: candidate.candidateId,
    });
    if (!invitation) {
      throw new AppError('Invitation not found', HTTP_STATUS.NOT_FOUND);
    }
    await expireIfNeeded(invitation);
    const extras = await loadJobCompany(invitation.jobId);
    return {
      invitation: mapInvitation(invitation, {
        job: extras.job,
        company: extras.company,
      }),
    };
  }

  async cancel(employer: AuthenticatedEmployer, id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invitation not found', HTTP_STATUS.NOT_FOUND);
    }
    const invitation = await JobInvitation.findOne({
      _id: id,
      employerId: employer.employerId,
      companyId: employer.companyId,
    });
    if (!invitation) {
      throw new AppError('Invitation not found', HTTP_STATUS.NOT_FOUND);
    }
    await expireIfNeeded(invitation);
    if (invitation.status !== 'pending') {
      throw new AppError(
        `Cannot cancel an invitation with status "${invitation.status}"`,
        HTTP_STATUS.CONFLICT,
      );
    }
    invitation.status = 'cancelled';
    invitation.respondedAt = new Date();
    await invitation.save();

    const extras = await loadJobCompany(invitation.jobId);
    return {
      invitation: mapInvitation(invitation, {
        job: extras.job,
        company: extras.company,
        candidate: await loadCandidateSummary(invitation.candidateId),
      }),
    };
  }

  async accept(candidate: AuthenticatedCandidate, id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invitation not found', HTTP_STATUS.NOT_FOUND);
    }
    const invitation = await JobInvitation.findOne({
      _id: id,
      candidateId: candidate.candidateId,
    });
    if (!invitation) {
      throw new AppError('Invitation not found', HTTP_STATUS.NOT_FOUND);
    }
    await expireIfNeeded(invitation);
    if (invitation.status !== 'pending') {
      throw new AppError(
        `Cannot accept an invitation with status "${invitation.status as InvitationStatus}"`,
        HTTP_STATUS.CONFLICT,
      );
    }

    // One-tap apply from invitation (reuses profile resume).
    const applyResult = await applicationService.apply(candidate, invitation.jobId.toString(), {
      coverLetter: '',
      answers: [],
    });

    invitation.status = 'accepted';
    invitation.respondedAt = new Date();
    invitation.applicationId = new mongoose.Types.ObjectId(applyResult.application.id);
    await invitation.save();

    const extras = await loadJobCompany(invitation.jobId);
    return {
      invitation: mapInvitation(invitation, {
        job: extras.job,
        company: extras.company,
      }),
      application: applyResult.application,
      confirmation: applyResult.confirmation,
    };
  }

  async decline(candidate: AuthenticatedCandidate, id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invitation not found', HTTP_STATUS.NOT_FOUND);
    }
    const invitation = await JobInvitation.findOne({
      _id: id,
      candidateId: candidate.candidateId,
    });
    if (!invitation) {
      throw new AppError('Invitation not found', HTTP_STATUS.NOT_FOUND);
    }
    await expireIfNeeded(invitation);
    if (invitation.status !== 'pending') {
      throw new AppError(
        `Cannot decline an invitation with status "${invitation.status}"`,
        HTTP_STATUS.CONFLICT,
      );
    }
    invitation.status = 'declined';
    invitation.respondedAt = new Date();
    await invitation.save();

    const employerUserId = await resolveEmployerUserId(invitation.employerId);
    if (employerUserId) {
      const extras = await loadJobCompany(invitation.jobId);
      await notifySafely({
        recipientId: employerUserId,
        type: 'SYSTEM',
        title: 'Invitation Declined',
        message: extras.job
          ? `A candidate declined your invitation for "${extras.job.title}".`
          : 'A candidate declined your job invitation.',
        data: {
          invitationId: invitation._id.toString(),
          jobId: invitation.jobId.toString(),
          candidateId: candidate.candidateId,
        },
      });
    }

    const extras = await loadJobCompany(invitation.jobId);
    return {
      invitation: mapInvitation(invitation, {
        job: extras.job,
        company: extras.company,
      }),
    };
  }
}

export const invitationService = new InvitationService();
