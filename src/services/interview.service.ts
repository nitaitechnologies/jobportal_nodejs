import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import type { ApplicationStatus, InterviewStatus } from '../constants/enums';
import { Application } from '../models/Application';
import { Candidate } from '../models/Candidate';
import { Company } from '../models/Company';
import { Interview } from '../models/Interview';
import { Job } from '../models/Job';
import { User } from '../models/User';
import type { AuthenticatedCandidate, AuthenticatedEmployer } from '../types/auth.types';
import {
  applicationStatusAfterInterviewCreate,
  isApplicationEligibleForInterview,
} from '../utils/interviewEligibility';
import {
  mapCandidateInterview,
  mapEmployerInterview,
} from '../utils/interviewMapper';
import {
  ACTIVE_INTERVIEW_STATUSES,
  canCandidateConfirm,
  canCandidateDecline,
  canCandidateReschedule,
  canEmployerCancel,
  canEmployerComplete,
  canEmployerMarkNoShow,
  canEmployerReschedule,
  canTransitionInterviewStatus,
} from '../utils/interviewStatus';
import { AppError } from '../utils/AppError';
import { trackSafely } from './analytics.service';
import { applicationService } from './application.service';
import { chatService } from './chat.service';
import {
  notifySafely,
  resolveCandidateUserId,
  resolveEmployerUserId,
} from './notification.service';
import type {
  CandidateInterviewQuery,
  EmployerInterviewQuery,
  InterviewCancelInput,
  InterviewCompleteInput,
  InterviewCreateInput,
  InterviewDeclineInput,
  InterviewNoShowInput,
  InterviewRescheduleInput,
  InterviewUpdateInput,
} from '../validators/interview.validator';

async function assertNoActiveConflict(applicationId: mongoose.Types.ObjectId) {
  const activeCount = await Interview.countDocuments({
    applicationId,
    status: { $in: ACTIVE_INTERVIEW_STATUSES },
  });
  if (activeCount > 0) {
    // Schema has no interview round field — only one active interview per application.
    throw new AppError(
      'An active interview already exists for this application',
      HTTP_STATUS.CONFLICT,
    );
  }
}

async function loadJobSummary(jobId: mongoose.Types.ObjectId) {
  const job = await Job.findById(jobId).select('title slug status companyId employerId');
  if (!job) {
    return null;
  }
  return {
    id: job._id.toString(),
    title: job.title,
    slug: job.slug,
    status: job.status,
  };
}

async function loadCompanySummary(companyId: mongoose.Types.ObjectId) {
  const company = await Company.findById(companyId).select('name slug logo industry');
  if (!company) {
    return null;
  }
  return {
    id: company._id.toString(),
    name: company.name,
    slug: company.slug,
    logo: company.logo ?? '',
    industry: company.industry ?? '',
  };
}

async function loadCandidateSummary(candidateId: mongoose.Types.ObjectId) {
  const candidate = await Candidate.findById(candidateId).select(
    'userId headline currentJobTitle skills resume totalExperience',
  );
  if (!candidate) {
    return null;
  }
  const user = await User.findById(candidate.userId).select('name email phone avatar');
  return {
    id: candidate._id.toString(),
    headline: candidate.headline ?? '',
    currentJobTitle: candidate.currentJobTitle ?? '',
    skills: candidate.skills ?? [],
    resume: candidate.resume ?? '',
    totalExperience: candidate.totalExperience ?? 0,
    user: user
      ? {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone ?? '',
          avatar: user.avatar ?? '',
        }
      : null,
  };
}

async function mapEmployerDetail(interview: InstanceType<typeof Interview>) {
  const [job, company, candidate, application] = await Promise.all([
    loadJobSummary(interview.jobId),
    loadCompanySummary(interview.companyId),
    loadCandidateSummary(interview.candidateId),
    Application.findById(interview.applicationId).select('status appliedAt coverLetter resume'),
  ]);

  return mapEmployerInterview(interview, {
    job,
    company,
    candidate,
    application: application
      ? {
          id: application._id.toString(),
          status: application.status,
          appliedAt: application.appliedAt,
          coverLetter: application.coverLetter ?? '',
          resume: application.resume ?? '',
        }
      : null,
  });
}

async function mapCandidateDetail(interview: InstanceType<typeof Interview>) {
  const [job, company, application] = await Promise.all([
    loadJobSummary(interview.jobId),
    loadCompanySummary(interview.companyId),
    Application.findById(interview.applicationId).select('status appliedAt'),
  ]);

  return mapCandidateInterview(interview, {
    job,
    company,
    application: application
      ? {
          id: application._id.toString(),
          status: application.status,
          appliedAt: application.appliedAt,
        }
      : null,
  });
}

function validateTypeRequirements(
  type: string,
  location: string,
  meetingLink: string,
  phoneContact = '',
): void {
  if (type === 'online' && !meetingLink.trim()) {
    throw new AppError('meetingLink is required for online interviews', HTTP_STATUS.BAD_REQUEST);
  }
  if (type === 'onsite' && !location.trim()) {
    throw new AppError('location is required for onsite interviews', HTTP_STATUS.BAD_REQUEST);
  }
  if (type === 'phone' && !phoneContact.trim()) {
    throw new AppError('phoneContact is required for phone interviews', HTTP_STATUS.BAD_REQUEST);
  }
}

export class InterviewService {
  async create(employer: AuthenticatedEmployer, input: InterviewCreateInput) {
    const application = await Application.findById(input.applicationId);
    if (!application) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }

    if (application.companyId.toString() !== employer.companyId) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }

    const job = await Job.findById(application.jobId).select(
      '_id companyId employerId deletedAt status',
    );
    if (!job || job.deletedAt || job.companyId.toString() !== employer.companyId) {
      throw new AppError('Job not found for this application', HTTP_STATUS.NOT_FOUND);
    }

    const candidate = await Candidate.findById(application.candidateId).select('_id');
    if (!candidate) {
      throw new AppError('Candidate not found for this application', HTTP_STATUS.NOT_FOUND);
    }

    if (!isApplicationEligibleForInterview(application.status as ApplicationStatus)) {
      throw new AppError(
        'Application is not eligible for interviews',
        HTTP_STATUS.BAD_REQUEST,
        [
          {
            path: 'applicationId',
            message: 'Application must be shortlisted or already in interview status',
          },
        ],
      );
    }

    await assertNoActiveConflict(application._id);

    const interview = await Interview.create({
      applicationId: application._id,
      candidateId: application.candidateId,
      employerId: application.employerId,
      companyId: application.companyId,
      jobId: application.jobId,
      type: input.type,
      scheduledAt: input.scheduledAt,
      duration: input.duration,
      location: input.location,
      meetingLink: input.meetingLink,
      interviewer: input.interviewer,
      phoneContact: input.phoneContact ?? '',
      notes: input.notes,
      status: 'scheduled',
    });

    const nextAppStatus = applicationStatusAfterInterviewCreate(
      application.status as ApplicationStatus,
    );
    if (nextAppStatus !== application.status) {
      application.status = nextAppStatus;
      await application.save();
    }

    await trackSafely({
      eventType: 'interview_scheduled',
      userId: employer.userId,
      actorRole: 'employer',
      entityType: 'interview',
      entityId: interview._id,
      jobId: interview.jobId,
      companyId: interview.companyId,
      employerId: interview.employerId,
      candidateId: interview.candidateId,
      metadata: { applicationId: interview.applicationId.toString(), type: interview.type },
    });

    const candidateUserId = await resolveCandidateUserId(application.candidateId);
    if (candidateUserId) {
      const jobTitle = (await Job.findById(application.jobId).select('title'))?.title;
      await notifySafely({
        recipientId: candidateUserId,
        type: 'INTERVIEW_SCHEDULED',
        title: 'Interview Scheduled',
        message: jobTitle
          ? `Your interview for "${jobTitle}" has been scheduled.`
          : 'Your interview has been scheduled.',
        data: {
          interviewId: interview._id.toString(),
          applicationId: application._id.toString(),
          jobId: application.jobId.toString(),
          scheduledAt: interview.scheduledAt.toISOString(),
        },
      });
    }

    await chatService.linkInterviewDiscussion(interview._id.toString()).catch(() => undefined);

    return {
      interview: await mapEmployerDetail(interview),
    };
  }

  async listEmployer(employer: AuthenticatedEmployer, query: EmployerInterviewQuery) {
    const filter: Record<string, unknown> = {
      companyId: new mongoose.Types.ObjectId(employer.companyId),
    };
    if (query.status) {
      filter.status = query.status;
    }
    if (query.jobId) {
      filter.jobId = new mongoose.Types.ObjectId(query.jobId);
    }
    if (query.applicationId) {
      filter.applicationId = new mongoose.Types.ObjectId(query.applicationId);
    }

    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      Interview.countDocuments(filter),
      Interview.find(filter)
        .sort({ scheduledAt: 1, createdAt: -1 })
        .skip(skip)
        .limit(query.limit),
    ]);

    const interviews = await Promise.all(rows.map((row) => mapEmployerDetail(row)));

    return {
      interviews,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getEmployerById(employer: AuthenticatedEmployer, id: string) {
    const interview = await Interview.findOne({
      _id: id,
      companyId: employer.companyId,
    });
    if (!interview) {
      throw new AppError('Interview not found', HTTP_STATUS.NOT_FOUND);
    }
    return {
      interview: await mapEmployerDetail(interview),
    };
  }

  async update(employer: AuthenticatedEmployer, id: string, input: InterviewUpdateInput) {
    const interview = await Interview.findOne({
      _id: id,
      companyId: employer.companyId,
    });
    if (!interview) {
      throw new AppError('Interview not found', HTTP_STATUS.NOT_FOUND);
    }

    if (!ACTIVE_INTERVIEW_STATUSES.includes(interview.status as InterviewStatus)) {
      throw new AppError('Interview can no longer be updated', HTTP_STATUS.BAD_REQUEST);
    }

    if (input.scheduledAt !== undefined) {
      interview.scheduledAt = input.scheduledAt;
    }
    if (input.duration !== undefined) {
      interview.duration = input.duration;
    }
    if (input.type !== undefined) {
      interview.type = input.type;
    }
    if (input.location !== undefined) {
      interview.location = input.location;
    }
    if (input.meetingLink !== undefined) {
      interview.meetingLink = input.meetingLink;
    }
    if (input.interviewer !== undefined) {
      interview.interviewer = input.interviewer;
    }
    if (input.phoneContact !== undefined) {
      interview.phoneContact = input.phoneContact;
    }
    if (input.notes !== undefined) {
      interview.notes = input.notes;
    }

    validateTypeRequirements(
      interview.type,
      interview.location ?? '',
      interview.meetingLink ?? '',
      interview.phoneContact ?? '',
    );

    await interview.save();
    return {
      interview: await mapEmployerDetail(interview),
    };
  }

  async reschedule(
    employer: AuthenticatedEmployer,
    id: string,
    input: InterviewRescheduleInput,
  ) {
    const interview = await Interview.findOne({
      _id: id,
      companyId: employer.companyId,
    });
    if (!interview) {
      throw new AppError('Interview not found', HTTP_STATUS.NOT_FOUND);
    }

    const status = interview.status as InterviewStatus;
    if (!canEmployerReschedule(status)) {
      throw new AppError('Interview cannot be rescheduled', HTTP_STATUS.BAD_REQUEST);
    }

    interview.scheduledAt = input.scheduledAt;
    if (input.duration !== undefined) {
      interview.duration = input.duration;
    }
    if (input.location !== undefined) {
      interview.location = input.location;
    }
    if (input.meetingLink !== undefined) {
      interview.meetingLink = input.meetingLink;
    }
    if (input.notes !== undefined) {
      interview.notes = input.notes;
    }

    validateTypeRequirements(
      interview.type,
      interview.location ?? '',
      interview.meetingLink ?? '',
      interview.phoneContact ?? '',
    );

    if (status !== 'rescheduled') {
      if (!canTransitionInterviewStatus(status, 'rescheduled')) {
        throw new AppError('Invalid status transition', HTTP_STATUS.BAD_REQUEST);
      }
      interview.status = 'rescheduled';
    }

    interview.reminder24hSentAt = null;
    interview.reminder1hSentAt = null;

    await interview.save();

    await trackSafely({
      eventType: 'interview_rescheduled',
      userId: employer.userId,
      actorRole: 'employer',
      entityType: 'interview',
      entityId: interview._id,
      jobId: interview.jobId,
      companyId: interview.companyId,
      employerId: interview.employerId,
      candidateId: interview.candidateId,
      metadata: { scheduledAt: interview.scheduledAt.toISOString() },
    });

    const candidateUserId = await resolveCandidateUserId(interview.candidateId);
    if (candidateUserId) {
      const jobTitle = (await Job.findById(interview.jobId).select('title'))?.title;
      await notifySafely({
        recipientId: candidateUserId,
        type: 'INTERVIEW_RESCHEDULED',
        title: 'Interview Rescheduled',
        message: jobTitle
          ? `Your interview for "${jobTitle}" has been rescheduled.`
          : 'Your interview has been rescheduled.',
        data: {
          interviewId: interview._id.toString(),
          applicationId: interview.applicationId.toString(),
          jobId: interview.jobId.toString(),
          scheduledAt: interview.scheduledAt.toISOString(),
        },
      });
    }

    return {
      interview: await mapEmployerDetail(interview),
    };
  }

  async cancel(employer: AuthenticatedEmployer, id: string, input: InterviewCancelInput) {
    const interview = await Interview.findOne({
      _id: id,
      companyId: employer.companyId,
    });
    if (!interview) {
      throw new AppError('Interview not found', HTTP_STATUS.NOT_FOUND);
    }

    const status = interview.status as InterviewStatus;
    if (!canEmployerCancel(status)) {
      throw new AppError('Interview cannot be cancelled', HTTP_STATUS.BAD_REQUEST);
    }

    interview.status = 'cancelled';
    interview.cancellationReason = input.cancellationReason || interview.cancellationReason || '';
    await interview.save();

    await trackSafely({
      eventType: 'interview_cancelled',
      userId: employer.userId,
      actorRole: 'employer',
      entityType: 'interview',
      entityId: interview._id,
      jobId: interview.jobId,
      companyId: interview.companyId,
      employerId: interview.employerId,
      candidateId: interview.candidateId,
    });

    const candidateUserId = await resolveCandidateUserId(interview.candidateId);
    if (candidateUserId) {
      const jobTitle = (await Job.findById(interview.jobId).select('title'))?.title;
      await notifySafely({
        recipientId: candidateUserId,
        type: 'INTERVIEW_CANCELLED',
        title: 'Interview Cancelled',
        message: jobTitle
          ? `Your interview for "${jobTitle}" has been cancelled.`
          : 'Your interview has been cancelled.',
        data: {
          interviewId: interview._id.toString(),
          applicationId: interview.applicationId.toString(),
          jobId: interview.jobId.toString(),
        },
      });
    }

    return {
      interview: await mapEmployerDetail(interview),
    };
  }

  async complete(
    employer: AuthenticatedEmployer,
    id: string,
    input: InterviewCompleteInput = {},
  ) {
    const interview = await Interview.findOne({
      _id: id,
      companyId: employer.companyId,
    });
    if (!interview) {
      throw new AppError('Interview not found', HTTP_STATUS.NOT_FOUND);
    }

    const status = interview.status as InterviewStatus;
    if (!canEmployerComplete(status)) {
      throw new AppError('Interview cannot be marked completed', HTTP_STATUS.BAD_REQUEST);
    }

    interview.status = 'completed';
    interview.feedback = {
      rating: input.rating ?? interview.feedback?.rating ?? null,
      outcome: input.outcome ?? interview.feedback?.outcome ?? '',
      notes: input.feedbackNotes?.trim() || interview.feedback?.notes || '',
      submittedAt: new Date(),
    };
    await interview.save();

    const applicationId = interview.applicationId.toString();
    const outcome = interview.feedback.outcome;
    if (outcome === 'hire' || outcome === 'reject') {
      const targetStatus = outcome === 'hire' ? 'hired' : 'rejected';
      try {
        await applicationService.updateStatus(employer, applicationId, {
          status: targetStatus,
        });
      } catch {
        // Transition may already be terminal / invalid — feedback still saved.
      }
    }

    if (typeof interview.feedback.rating === 'number') {
      try {
        await applicationService.setInternalRating(employer, applicationId, {
          rating: interview.feedback.rating,
        });
      } catch {
        // Rating sync is best-effort.
      }
    }

    return {
      interview: await mapEmployerDetail(interview),
    };
  }

  async markNoShow(
    employer: AuthenticatedEmployer,
    id: string,
    input: InterviewNoShowInput = {},
  ) {
    const interview = await Interview.findOne({
      _id: id,
      companyId: employer.companyId,
    });
    if (!interview) {
      throw new AppError('Interview not found', HTTP_STATUS.NOT_FOUND);
    }

    const status = interview.status as InterviewStatus;
    if (!canEmployerMarkNoShow(status)) {
      throw new AppError('Interview cannot be marked as no-show', HTTP_STATUS.BAD_REQUEST);
    }

    interview.status = 'no-show';
    if (input.notes?.trim()) {
      interview.notes = interview.notes
        ? `${interview.notes}\n\nNo-show note: ${input.notes.trim()}`
        : `No-show note: ${input.notes.trim()}`;
    }
    await interview.save();
    return {
      interview: await mapEmployerDetail(interview),
    };
  }

  async listCandidate(candidate: AuthenticatedCandidate, query: CandidateInterviewQuery) {
    const filter: Record<string, unknown> = {
      candidateId: new mongoose.Types.ObjectId(candidate.candidateId),
    };
    if (query.status) {
      filter.status = query.status;
    }
    if (query.upcoming === true) {
      filter.status = query.status
        ? query.status
        : { $in: ACTIVE_INTERVIEW_STATUSES };
      filter.scheduledAt = { $gte: new Date() };
    }

    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      Interview.countDocuments(filter),
      Interview.find(filter)
        .sort({ scheduledAt: 1, createdAt: -1 })
        .skip(skip)
        .limit(query.limit),
    ]);

    const interviews = await Promise.all(rows.map((row) => mapCandidateDetail(row)));

    return {
      interviews,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getCandidateById(candidate: AuthenticatedCandidate, id: string) {
    const interview = await Interview.findOne({
      _id: id,
      candidateId: candidate.candidateId,
    });
    if (!interview) {
      throw new AppError('Interview not found', HTTP_STATUS.NOT_FOUND);
    }
    return {
      interview: await mapCandidateDetail(interview),
    };
  }

  async confirm(candidate: AuthenticatedCandidate, id: string) {
    const interview = await Interview.findOne({
      _id: id,
      candidateId: candidate.candidateId,
    });
    if (!interview) {
      throw new AppError('Interview not found', HTTP_STATUS.NOT_FOUND);
    }

    const status = interview.status as InterviewStatus;
    if (!canCandidateConfirm(status)) {
      throw new AppError('Interview cannot be confirmed', HTTP_STATUS.BAD_REQUEST);
    }

    interview.status = 'confirmed';
    await interview.save();

    await trackSafely({
      eventType: 'interview_confirmed',
      userId: candidate.userId,
      actorRole: 'candidate',
      entityType: 'interview',
      entityId: interview._id,
      jobId: interview.jobId,
      companyId: interview.companyId,
      employerId: interview.employerId,
      candidateId: interview.candidateId,
    });

    const employerUserId = await resolveEmployerUserId(interview.employerId);
    if (employerUserId) {
      const jobTitle = (await Job.findById(interview.jobId).select('title'))?.title;
      await notifySafely({
        recipientId: employerUserId,
        type: 'INTERVIEW_CONFIRMED',
        title: 'Interview Confirmed',
        message: jobTitle
          ? `A candidate confirmed the interview for "${jobTitle}".`
          : 'A candidate confirmed an interview.',
        data: {
          interviewId: interview._id.toString(),
          applicationId: interview.applicationId.toString(),
          jobId: interview.jobId.toString(),
          candidateId: interview.candidateId.toString(),
        },
      });
    }

    await chatService.linkInterviewDiscussion(interview._id.toString()).catch(() => undefined);

    return {
      interview: await mapCandidateDetail(interview),
    };
  }

  async decline(
    candidate: AuthenticatedCandidate,
    id: string,
    input: InterviewDeclineInput,
  ) {
    const interview = await Interview.findOne({
      _id: id,
      candidateId: candidate.candidateId,
    });
    if (!interview) {
      throw new AppError('Interview not found', HTTP_STATUS.NOT_FOUND);
    }

    const status = interview.status as InterviewStatus;
    if (!canCandidateDecline(status)) {
      throw new AppError('Interview cannot be declined', HTTP_STATUS.BAD_REQUEST);
    }

    interview.status = 'declined';
    interview.cancellationReason = input.cancellationReason || interview.cancellationReason || '';
    await interview.save();

    await trackSafely({
      eventType: 'interview_declined',
      userId: candidate.userId,
      actorRole: 'candidate',
      entityType: 'interview',
      entityId: interview._id,
      jobId: interview.jobId,
      companyId: interview.companyId,
      employerId: interview.employerId,
      candidateId: interview.candidateId,
    });

    const employerUserId = await resolveEmployerUserId(interview.employerId);
    if (employerUserId) {
      const jobTitle = (await Job.findById(interview.jobId).select('title'))?.title;
      await notifySafely({
        recipientId: employerUserId,
        type: 'INTERVIEW_DECLINED',
        title: 'Interview Declined',
        message: jobTitle
          ? `A candidate declined the interview for "${jobTitle}".`
          : 'A candidate declined an interview.',
        data: {
          interviewId: interview._id.toString(),
          applicationId: interview.applicationId.toString(),
          jobId: interview.jobId.toString(),
          candidateId: interview.candidateId.toString(),
        },
      });
    }

    return {
      interview: await mapCandidateDetail(interview),
    };
  }

  /**
   * Candidate proposes a new time (129). Mirrors employer reschedule:
   * updates scheduledAt, sets status to rescheduled, notifies employer.
   * Clears reminder flags so 24h/1h workers fire again for the new slot.
   */
  async candidateReschedule(
    candidate: AuthenticatedCandidate,
    id: string,
    input: InterviewRescheduleInput,
  ) {
    const interview = await Interview.findOne({
      _id: id,
      candidateId: candidate.candidateId,
    });
    if (!interview) {
      throw new AppError('Interview not found', HTTP_STATUS.NOT_FOUND);
    }

    const status = interview.status as InterviewStatus;
    if (!canCandidateReschedule(status)) {
      throw new AppError('Interview cannot be rescheduled', HTTP_STATUS.BAD_REQUEST);
    }

    interview.scheduledAt = input.scheduledAt;
    if (input.duration !== undefined) {
      interview.duration = input.duration;
    }
    if (input.location !== undefined) {
      interview.location = input.location;
    }
    if (input.meetingLink !== undefined) {
      interview.meetingLink = input.meetingLink;
    }
    if (input.notes !== undefined) {
      interview.notes = input.notes;
    }

    validateTypeRequirements(
      interview.type,
      interview.location ?? '',
      interview.meetingLink ?? '',
      interview.phoneContact ?? '',
    );

    if (status !== 'rescheduled') {
      if (!canTransitionInterviewStatus(status, 'rescheduled')) {
        throw new AppError('Invalid status transition', HTTP_STATUS.BAD_REQUEST);
      }
      interview.status = 'rescheduled';
    }

    // New time → allow reminder worker to send again
    interview.reminder24hSentAt = null;
    interview.reminder1hSentAt = null;

    await interview.save();

    await trackSafely({
      eventType: 'interview_rescheduled',
      userId: candidate.userId,
      actorRole: 'candidate',
      entityType: 'interview',
      entityId: interview._id,
      jobId: interview.jobId,
      companyId: interview.companyId,
      employerId: interview.employerId,
      candidateId: interview.candidateId,
      metadata: {
        scheduledAt: interview.scheduledAt.toISOString(),
        requestedBy: 'candidate',
      },
    });

    const employerUserId = await resolveEmployerUserId(interview.employerId);
    if (employerUserId) {
      const jobTitle = (await Job.findById(interview.jobId).select('title'))?.title;
      await notifySafely({
        recipientId: employerUserId,
        type: 'INTERVIEW_RESCHEDULED',
        title: 'Interview Reschedule Requested',
        message: jobTitle
          ? `A candidate proposed a new time for the "${jobTitle}" interview.`
          : 'A candidate proposed a new interview time.',
        data: {
          interviewId: interview._id.toString(),
          applicationId: interview.applicationId.toString(),
          jobId: interview.jobId.toString(),
          candidateId: interview.candidateId.toString(),
          scheduledAt: interview.scheduledAt.toISOString(),
          requestedBy: 'candidate',
        },
      });
    }

    return {
      interview: await mapCandidateDetail(interview),
    };
  }
}

export const interviewService = new InterviewService();
