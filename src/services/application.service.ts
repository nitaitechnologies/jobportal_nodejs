import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import type { ApplicationStatus } from '../constants/enums';
import { env } from '../config/env';
import { Application } from '../models/Application';
import { Candidate } from '../models/Candidate';
import { Category } from '../models/Category';
import { Company } from '../models/Company';
import { Job } from '../models/Job';
import { Location } from '../models/Location';
import { MediaFile } from '../models/MediaFile';
import { User } from '../models/User';
import type { AuthenticatedCandidate, AuthenticatedEmployer } from '../types/auth.types';
import { scoreJobMatch } from '../utils/matchScore';
import {
  mapCandidateApplication,
  mapEmployerApplication,
} from '../utils/applicationMapper';
import {
  canCandidateWithdraw,
  canEmployerTransition,
  employerTimestampField,
} from '../utils/applicationStatus';
import { AppError } from '../utils/AppError';
import { mapPublicJobSummary } from '../utils/jobMapper';
import { isJobPubliclyVisible } from '../utils/jobVisibility';
import {
  notifySafely,
  resolveCandidateUserId,
  resolveEmployerUserId,
} from './notification.service';
import { trackSafely } from './analytics.service';
import { candidateSafetyService } from './candidateSafety.service';
import type {
  ApplicationApplyInput,
  ApplicationBulkMessageInput,
  ApplicationBulkStatusInput,
  ApplicationInternalRatingInput,
  ApplicationNotesUpdateInput,
  ApplicationStatusUpdateInput,
  CandidateApplicationQuery,
  EmployerApplicationExportQuery,
  EmployerApplicationQuery,
  EmployerApplicationStatsQuery,
} from '../validators/application.validator';
import { Employer } from '../models/Employer';
import { chatService } from './chat.service';

async function resolveEmployerActorName(employer: AuthenticatedEmployer): Promise<string> {
  const [user, profile] = await Promise.all([
    User.findById(employer.userId).select('name'),
    Employer.findById(employer.employerId).select('designation'),
  ]);
  return user?.name?.trim() || profile?.designation?.trim() || 'Hiring team';
}

function pushStatusHistory(
  application: {
    statusHistory: { push: (doc: unknown) => unknown; length: number; splice: (start: number, deleteCount?: number) => unknown };
  },
  from: ApplicationStatus,
  to: ApplicationStatus,
  actor: { userId: string; name: string; auto?: boolean },
) {
  application.statusHistory.push({
    from,
    to,
    at: new Date(),
    byUserId: new mongoose.Types.ObjectId(actor.userId),
    byName: actor.name,
    auto: Boolean(actor.auto),
  });
  if (application.statusHistory.length > 50) {
    application.statusHistory.splice(0, application.statusHistory.length - 50);
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

async function loadJobPublicExtras(job: {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  employerId?: mongoose.Types.ObjectId;
  description?: string;
  categoryId?: mongoose.Types.ObjectId | null;
  location?: {
    locationId?: mongoose.Types.ObjectId | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    area?: string | null;
    displayName?: string | null;
  } | null;
  title: string;
  slug: string;
  skills?: string[] | null;
  workMode: string;
  employmentType: string;
  experienceMin?: number | null;
  experienceMax?: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryPeriod?: string | null;
  openings?: number | null;
  featured?: boolean | null;
  urgent?: boolean | null;
  publishedAt?: Date | null;
  applicationDeadline?: Date | null;
}) {
  const [company, category, locationMeta] = await Promise.all([
    Company.findById(job.companyId).select(
      'name slug logo industry companySize headquarters status verificationStatus',
    ),
    job.categoryId
      ? Category.findById(job.categoryId).select('name slug')
      : Promise.resolve(null),
    job.location?.locationId
      ? Location.findById(job.location.locationId).select('name slug type')
      : Promise.resolve(null),
  ]);

  const summary = mapPublicJobSummary(
    {
      _id: job._id,
      companyId: job.companyId,
      employerId: job.employerId ?? job.companyId,
      title: job.title,
      slug: job.slug,
      description: job.description ?? '',
      skills: job.skills ?? [],
      categoryId: job.categoryId,
      location: job.location ?? undefined,
      workMode: job.workMode,
      employmentType: job.employmentType,
      experienceMin: job.experienceMin ?? 0,
      experienceMax: job.experienceMax ?? null,
      salaryMin: job.salaryMin ?? null,
      salaryMax: job.salaryMax ?? null,
      salaryPeriod: job.salaryPeriod ?? 'monthly',
      openings: job.openings ?? 1,
      featured: job.featured ?? false,
      urgent: job.urgent ?? false,
      publishedAt: job.publishedAt ?? null,
    },
    {
      category: category
        ? { id: category._id.toString(), name: category.name, slug: category.slug }
        : null,
      company: company
        ? {
            id: company._id.toString(),
            name: company.name,
            slug: company.slug,
            logo: company.logo ?? '',
            industry: company.industry ?? '',
            companySize: company.companySize ?? null,
            headquarters: company.headquarters ?? '',
            verificationStatus: company.verificationStatus,
            verified: company.verificationStatus === 'verified',
          }
        : null,
      location: job.location
        ? {
            locationId: job.location.locationId?.toString() ?? null,
            name: locationMeta?.name,
            slug: locationMeta?.slug,
            type: locationMeta?.type,
            city: job.location.city ?? '',
            state: job.location.state ?? '',
            country: job.location.country ?? '',
            area: job.location.area ?? '',
            displayName: job.location.displayName ?? locationMeta?.name ?? '',
          }
        : null,
    },
  );

  return {
    job: {
      ...summary,
      deadline: job.applicationDeadline ?? null,
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
  };
}

function redactResumeForEmployer(resume: string | null | undefined): string {
  const value = resume?.trim() ?? '';
  if (!value) return '';
  // Never expose private media storage keys / internal media: IDs to employers.
  if (value.startsWith('media:')) return '[resume on file]';
  if (/^https?:\/\//i.test(value)) return value;
  return '[resume on file]';
}

async function resolveApplyResume(
  candidateUserId: string,
  candidateResume: string | null | undefined,
  inputResume?: string,
): Promise<string> {
  const fallback = candidateResume?.trim() ?? '';
  const requested = inputResume?.trim() ?? '';
  if (!requested) return fallback;

  if (requested.startsWith('media:')) {
    const mediaId = requested.slice('media:'.length);
    if (!mongoose.Types.ObjectId.isValid(mediaId)) {
      throw new AppError('Invalid resume reference', HTTP_STATUS.BAD_REQUEST);
    }
    const media = await MediaFile.findById(mediaId).select(
      'ownerUserId category visibility status',
    );
    if (
      !media ||
      media.status !== 'active' ||
      media.ownerUserId.toString() !== candidateUserId ||
      media.category !== 'candidate_resume'
    ) {
      throw new AppError('Resume reference is not allowed', HTTP_STATUS.FORBIDDEN);
    }
    return `media:${mediaId}`;
  }

  try {
    const parsed = new URL(requested);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new AppError('Resume URL must use http or https', HTTP_STATUS.BAD_REQUEST);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Invalid resume URL', HTTP_STATUS.BAD_REQUEST);
  }

  return requested;
}

async function resolveApplyVideoResume(
  candidateUserId: string,
  candidateVideoResume: string | null | undefined,
  inputVideoResume?: string,
): Promise<string> {
  if (!env.enableVideoResume) return '';

  const fallback = candidateVideoResume?.trim() ?? '';
  const requested = inputVideoResume?.trim() ?? '';
  if (!requested) return fallback;

  if (requested.startsWith('media:')) {
    const mediaId = requested.slice('media:'.length);
    if (!mongoose.Types.ObjectId.isValid(mediaId)) {
      throw new AppError('Invalid video resume reference', HTTP_STATUS.BAD_REQUEST);
    }
    const media = await MediaFile.findById(mediaId).select(
      'ownerUserId category visibility status',
    );
    if (
      !media ||
      media.status !== 'active' ||
      media.ownerUserId.toString() !== candidateUserId ||
      media.category !== 'candidate_video_resume'
    ) {
      throw new AppError('Video resume reference is not allowed', HTTP_STATUS.FORBIDDEN);
    }
    return `media:${mediaId}`;
  }

  throw new AppError('Invalid video resume reference', HTTP_STATUS.BAD_REQUEST);
}

function matchFor(
  job: {
    title: string;
    skills?: string[] | null;
    requirements?: string[] | null;
    experienceMin?: number | null;
    experienceMax?: number | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    workMode?: string | null;
    location?: {
      address?: string | null;
      city?: string | null;
      displayName?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    } | null;
  },
  candidate: {
    headline?: string;
    currentJobTitle?: string;
    skills?: string[];
    totalExperience?: number;
    expectedSalary?: number | null;
    currentLocation?: string;
    latitude?: number | null;
    longitude?: number | null;
  },
) {
  const location = job.location;
  return scoreJobMatch(
    {
      title: job.title,
      skills: job.skills ?? [],
      requirements: job.requirements ?? [],
      experienceMin: job.experienceMin ?? 0,
      experienceMax: job.experienceMax ?? null,
      salaryMin: job.salaryMin ?? null,
      salaryMax: job.salaryMax ?? null,
      workMode: job.workMode,
      locationText: [location?.address, location?.city, location?.displayName].filter(Boolean).join(' '),
      latitude: typeof location?.latitude === 'number' ? location.latitude : null,
      longitude: typeof location?.longitude === 'number' ? location.longitude : null,
    },
    candidate,
  );
}

async function loadEmployerCandidateView(candidateId: mongoose.Types.ObjectId) {
  const candidate = await Candidate.findById(candidateId);
  if (!candidate) {
    return null;
  }
  const user = await User.findById(candidate.userId).select('name email phone avatar');
  return {
    id: candidate._id.toString(),
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    avatar: user?.avatar ?? '',
    headline: candidate.headline ?? '',
    currentJobTitle: candidate.currentJobTitle ?? '',
    currentLocation: candidate.currentLocation ?? '',
    totalExperience: candidate.totalExperience ?? 0,
    skills: candidate.skills ?? [],
    education: candidate.education ?? [],
    workExperience: candidate.workExperience ?? [],
    resume: redactResumeForEmployer(candidate.resume),
    hasResume: Boolean(candidate.resume?.trim()),
    hasVideoResume: env.enableVideoResume && Boolean((candidate.videoResume ?? '').trim()),
    portfolio: candidate.portfolio ?? '',
    expectedSalary: candidate.expectedSalary ?? null,
    noticePeriod: candidate.noticePeriod ?? 0,
    availableFrom: candidate.availableFrom ?? null,
    latitude: typeof candidate.latitude === 'number' ? candidate.latitude : null,
    longitude: typeof candidate.longitude === 'number' ? candidate.longitude : null,
  };
}

export class ApplicationService {
  async apply(
    candidate: AuthenticatedCandidate,
    jobId: string,
    input: ApplicationApplyInput,
  ) {
    const job = await Job.findById(jobId);
    if (!job) {
      throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
    }

    const company = await Company.findById(job.companyId).select(
      'status verificationStatus name slug',
    );
    if (!isJobPubliclyVisible(job, company)) {
      throw new AppError('Job is not available for applications', HTTP_STATUS.BAD_REQUEST);
    }

    if (job.applicationDeadline && job.applicationDeadline.getTime() <= Date.now()) {
      throw new AppError('Application deadline has passed', HTTP_STATUS.BAD_REQUEST);
    }

    if (job.applicationMethod && job.applicationMethod !== 'platform') {
      throw new AppError(
        `This job uses ${job.applicationMethod} applications and cannot be applied to on the platform`,
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const employer = await Employer.findById(job.employerId).select('userId');
    if (employer?.userId) {
      await candidateSafetyService.assertCandidateNotBlockingEmployerUser(
        candidate.userId,
        employer.userId.toString(),
      );
    }

    const candidateDoc = await Candidate.findById(candidate.candidateId);
    if (!candidateDoc) {
      throw new AppError('Candidate access denied', HTTP_STATUS.FORBIDDEN);
    }

    const resume = await resolveApplyResume(
      candidate.userId,
      candidateDoc.resume,
      input.resume,
    );
    const videoResume = await resolveApplyVideoResume(
      candidate.userId,
      candidateDoc.videoResume,
      input.videoResume,
    );

    // Re-apply after withdraw: unique {candidateId,jobId} means we reactivate the row.
    const existing = await Application.findOne({
      candidateId: candidate.candidateId,
      jobId: job._id,
    });

    const screeningQuestions = (job.screeningQuestions ?? []) as Array<{
      id: string;
      text: string;
      required?: boolean;
      type?: string;
    }>;
    const answerByQuestion = new Map(
      (input.answers ?? []).map((item) => [
        item.question.trim().toLowerCase(),
        item.answer?.trim() ?? '',
      ]),
    );
    const normalizedAnswers = screeningQuestions.map((q) => {
      const answer =
        answerByQuestion.get(q.text.trim().toLowerCase()) ??
        (input.answers ?? []).find((a) => a.question === q.id)?.answer?.trim() ??
        '';
      return { question: q.text, answer };
    });
    for (const item of input.answers ?? []) {
      const key = item.question.trim().toLowerCase();
      if (!screeningQuestions.some((q) => q.text.trim().toLowerCase() === key)) {
        normalizedAnswers.push({
          question: item.question.trim(),
          answer: item.answer?.trim() ?? '',
        });
      }
    }

    const missingRequired = screeningQuestions.filter((q) => {
      if (!q.required) return false;
      const found = normalizedAnswers.find(
        (a) => a.question.trim().toLowerCase() === q.text.trim().toLowerCase(),
      );
      return !found?.answer;
    });
    if (missingRequired.length > 0) {
      throw new AppError(
        'Please answer all required screening questions',
        HTTP_STATUS.BAD_REQUEST,
        missingRequired.map((q) => ({
          path: 'answers',
          message: `Required: ${q.text}`,
        })),
      );
    }

    const matchPreview = scoreJobMatch(
      {
        title: job.title,
        skills: job.skills,
        requirements: job.requirements,
        experienceMin: job.experienceMin,
        experienceMax: job.experienceMax,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        workMode: job.workMode,
        locationText: [job.location?.address, job.location?.city, job.location?.displayName]
          .filter(Boolean)
          .join(' '),
        latitude: typeof job.location?.latitude === 'number' ? job.location.latitude : null,
        longitude: typeof job.location?.longitude === 'number' ? job.location.longitude : null,
      },
      {
        headline: candidateDoc.headline,
        currentJobTitle: candidateDoc.currentJobTitle,
        skills: candidateDoc.skills,
        totalExperience: candidateDoc.totalExperience,
        expectedSalary: candidateDoc.expectedSalary,
        currentLocation: candidateDoc.currentLocation,
        latitude: candidateDoc.latitude,
        longitude: candidateDoc.longitude,
        openToWork: candidateDoc.openToWork,
        availableFrom: candidateDoc.availableFrom,
        noticePeriod: candidateDoc.noticePeriod,
      },
    );

    const autoFilter = job.screeningAutoFilter as
      | { enabled?: boolean; minMatchScore?: number }
      | undefined;
    const autoReject =
      Boolean(autoFilter?.enabled) &&
      matchPreview.overall < (autoFilter?.minMatchScore ?? 40);

    if (existing) {
      if (existing.status !== 'withdrawn') {
        throw new AppError('You have already applied to this job', HTTP_STATUS.CONFLICT);
      }

      existing.resume = resume;
      existing.videoResume = videoResume;
      existing.coverLetter = input.coverLetter ?? '';
      existing.answers = normalizedAnswers as typeof existing.answers;
      existing.status = autoReject ? 'rejected' : 'applied';
      existing.appliedAt = new Date();
      existing.notes = autoReject
        ? `Auto-filtered: match ${Math.round(matchPreview.overall)}% below threshold.`
        : '';
      existing.source = 'platform';
      existing.set('viewedAt', undefined);
      existing.set('shortlistedAt', undefined);
      existing.set('interviewAt', undefined);
      existing.set('rejectedAt', autoReject ? new Date() : undefined);
      existing.set('hiredAt', undefined);
      await existing.save();

      await Job.updateOne({ _id: job._id }, { $inc: { applicationsCount: 1 } });
      return this.finalizeApplySuccess(candidate, job, existing, {
        reactivated: true,
        autoFiltered: autoReject,
        matchPercentage: Math.round(matchPreview.overall),
      });
    }

    try {
      const application = await Application.create({
        candidateId: new mongoose.Types.ObjectId(candidate.candidateId),
        jobId: job._id,
        employerId: job.employerId,
        companyId: job.companyId,
        resume,
        videoResume,
        coverLetter: input.coverLetter ?? '',
        answers: normalizedAnswers,
        status: autoReject ? 'rejected' : 'applied',
        appliedAt: new Date(),
        rejectedAt: autoReject ? new Date() : undefined,
        notes: autoReject
          ? `Auto-filtered: match ${Math.round(matchPreview.overall)}% below threshold.`
          : '',
        source: 'platform',
      });

      await Job.updateOne({ _id: job._id }, { $inc: { applicationsCount: 1 } });
      return this.finalizeApplySuccess(candidate, job, application, {
        autoFiltered: autoReject,
        matchPercentage: Math.round(matchPreview.overall),
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AppError('You have already applied to this job', HTTP_STATUS.CONFLICT);
      }
      throw error;
    }
  }

  private async finalizeApplySuccess(
    candidate: AuthenticatedCandidate,
    job: {
      _id: mongoose.Types.ObjectId;
      title: string;
      companyId: mongoose.Types.ObjectId;
      employerId: mongoose.Types.ObjectId;
      categoryId?: mongoose.Types.ObjectId | null;
      location?: { locationId?: mongoose.Types.ObjectId | null } | null;
      description?: string;
      slug: string;
      skills?: string[] | null;
      workMode: string;
      employmentType: string;
      experienceMin?: number | null;
      experienceMax?: number | null;
      salaryMin?: number | null;
      salaryMax?: number | null;
      salaryPeriod?: string | null;
      openings?: number | null;
      featured?: boolean | null;
      urgent?: boolean | null;
      publishedAt?: Date | null;
      applicationDeadline?: Date | null;
    },
    application: {
      _id: mongoose.Types.ObjectId;
      resume?: string | null;
      videoResume?: string | null;
      coverLetter?: string | null;
      answers?: Array<{ question: string; answer?: string }>;
      status?: string;
      appliedAt?: Date | null;
      viewedAt?: Date | null;
      shortlistedAt?: Date | null;
      rejectedAt?: Date | null;
      hiredAt?: Date | null;
      createdAt?: Date;
      updatedAt?: Date;
      jobId: mongoose.Types.ObjectId;
      candidateId: mongoose.Types.ObjectId;
      employerId: mongoose.Types.ObjectId;
      companyId: mongoose.Types.ObjectId;
    },
    metadata?: Record<string, unknown>,
  ) {
    await trackSafely({
      eventType: 'application_submitted',
      userId: candidate.userId,
      actorRole: 'candidate',
      entityType: 'application',
      entityId: application._id,
      jobId: job._id,
      companyId: job.companyId,
      employerId: job.employerId,
      candidateId: candidate.candidateId,
      categoryId: job.categoryId,
      locationId: job.location?.locationId,
      ...(metadata ? { metadata } : {}),
    });

    const employerUserId = await resolveEmployerUserId(job.employerId);
    if (employerUserId) {
      await notifySafely({
        recipientId: employerUserId,
        type: 'APPLICATION_SUBMITTED',
        title: 'New Application Received',
        message: `A candidate has applied to your job "${job.title}".`,
        data: {
          applicationId: application._id.toString(),
          jobId: job._id.toString(),
          candidateId: candidate.candidateId,
        },
      });

      // 309 — high-fit new applicant also surfaces as matching candidate.
      const matchPct =
        typeof metadata?.matchPercentage === 'number' ? metadata.matchPercentage : null;
      if (matchPct !== null && matchPct >= 70) {
        await notifySafely({
          recipientId: employerUserId,
          type: 'MATCHING_CANDIDATE',
          title: 'New matching candidate',
          message: `A ${matchPct}% match applied to "${job.title}".`,
          data: {
            applicationId: application._id.toString(),
            jobId: job._id.toString(),
            candidateId: candidate.candidateId,
            matchPercentage: matchPct,
          },
        });
      }
    }

    await notifySafely({
      recipientId: candidate.userId,
      type: 'APPLICATION_CONFIRMATION',
      title: 'Application Submitted',
      message: `Your application for "${job.title}" was submitted successfully.`,
      data: {
        applicationId: application._id.toString(),
        jobId: job._id.toString(),
        status: 'applied',
      },
    });

    const extras = await loadJobPublicExtras(job);
    const mapped = mapCandidateApplication(application, extras);
    return {
      application: mapped,
      confirmation: {
        message: 'Application submitted successfully',
        applicationId: application._id.toString(),
        jobId: job._id.toString(),
        status: 'applied',
        appliedAt: mapped.appliedAt,
      },
    };
  }

  async listCandidate(candidate: AuthenticatedCandidate, query: CandidateApplicationQuery) {
    const filter: Record<string, unknown> = {
      candidateId: new mongoose.Types.ObjectId(candidate.candidateId),
    };
    if (query.status) {
      filter.status = query.status;
    }
    if (query.jobId) {
      filter.jobId = new mongoose.Types.ObjectId(query.jobId);
    }

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      Application.find(filter).sort({ appliedAt: -1, createdAt: -1 }).skip(skip).limit(query.limit),
      Application.countDocuments(filter),
    ]);

    const jobs = await Job.find({
      _id: { $in: items.map((item) => item.jobId) },
    });
    const jobMap = new Map(jobs.map((job) => [job._id.toString(), job]));

    const applications = await Promise.all(
      items.map(async (item) => {
        const job = jobMap.get(item.jobId.toString());
        const extras = job ? await loadJobPublicExtras(job) : { job: null, company: null };
        return mapCandidateApplication(item, extras);
      }),
    );

    return {
      applications,
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
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }

    const application = await Application.findOne({
      _id: id,
      candidateId: candidate.candidateId,
    });
    if (!application) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }

    const job = await Job.findById(application.jobId);
    const extras = job ? await loadJobPublicExtras(job) : { job: null, company: null };
    return {
      application: mapCandidateApplication(application, extras),
    };
  }

  async withdraw(candidate: AuthenticatedCandidate, id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }

    const application = await Application.findOne({
      _id: id,
      candidateId: candidate.candidateId,
    });
    if (!application) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }

    const status = application.status as ApplicationStatus;
    if (!canCandidateWithdraw(status)) {
      throw new AppError(
        `Cannot withdraw an application with status "${status}"`,
        HTTP_STATUS.CONFLICT,
      );
    }

    application.status = 'withdrawn';
    await application.save();

    await Job.updateOne(
      { _id: application.jobId, applicationsCount: { $gt: 0 } },
      { $inc: { applicationsCount: -1 } },
    );

    await trackSafely({
      eventType: 'application_withdrawn',
      userId: candidate.userId,
      actorRole: 'candidate',
      entityType: 'application',
      entityId: application._id,
      jobId: application.jobId,
      companyId: application.companyId,
      employerId: application.employerId,
      candidateId: application.candidateId,
    });

    const job = await Job.findById(application.jobId);
    const extras = job ? await loadJobPublicExtras(job) : { job: null, company: null };
    return {
      application: mapCandidateApplication(application, extras),
    };
  }

  async listEmployer(employer: AuthenticatedEmployer, query: EmployerApplicationQuery) {
    const filter: Record<string, unknown> = {
      employerId: new mongoose.Types.ObjectId(employer.employerId),
      companyId: new mongoose.Types.ObjectId(employer.companyId),
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.jobId) {
      const ownedJob = await Job.findOne({
        _id: query.jobId,
        employerId: employer.employerId,
        companyId: employer.companyId,
        deletedAt: null,
      }).select('_id');
      if (!ownedJob) {
        throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
      }
      filter.jobId = ownedJob._id;
    }

    const q = query.q?.trim();
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      const [users, candidates, jobs] = await Promise.all([
        User.find({ role: 'candidate', name: rx }).select('_id').limit(200),
        Candidate.find({
          $or: [{ headline: rx }, { currentJobTitle: rx }, { skills: rx }, { currentLocation: rx }],
        })
          .select('_id userId')
          .limit(200),
        Job.find({
          employerId: employer.employerId,
          companyId: employer.companyId,
          deletedAt: null,
          title: rx,
        })
          .select('_id')
          .limit(100),
      ]);
      const userIds = new Set(users.map((u) => u._id.toString()));
      const candidateIds = new Set<string>();
      for (const c of candidates) {
        candidateIds.add(c._id.toString());
      }
      if (userIds.size > 0) {
        const byUser = await Candidate.find({ userId: { $in: [...userIds] } })
          .select('_id')
          .limit(200);
        for (const c of byUser) candidateIds.add(c._id.toString());
      }
      const orClauses: Record<string, unknown>[] = [];
      if (candidateIds.size > 0) {
        orClauses.push({
          candidateId: { $in: [...candidateIds].map((id) => new mongoose.Types.ObjectId(id)) },
        });
      }
      if (jobs.length > 0) {
        orClauses.push({ jobId: { $in: jobs.map((j) => j._id) } });
      }
      orClauses.push({ notes: rx }, { coverLetter: rx });
      filter.$or = orClauses;
    }

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      Application.find(filter).sort({ appliedAt: -1, createdAt: -1 }).skip(skip).limit(query.limit),
      Application.countDocuments(filter),
    ]);

    const jobs = await Job.find({ _id: { $in: items.map((item) => item.jobId) } }).select(
      'title slug status workMode employmentType skills requirements experienceMin experienceMax salaryMin salaryMax location',
    );
    const jobMap = new Map(jobs.map((job) => [job._id.toString(), job]));

    const applications = await Promise.all(
      items.map(async (item) => {
        const job = jobMap.get(item.jobId.toString());
        const candidateView = await loadEmployerCandidateView(item.candidateId);
        return mapEmployerApplication(item, {
          job: job
            ? {
                id: job._id.toString(),
                title: job.title,
                slug: job.slug,
                status: job.status,
                workMode: job.workMode,
                employmentType: job.employmentType,
              }
            : null,
          candidate: candidateView,
          match: job && candidateView ? matchFor(job, candidateView) : null,
        });
      }),
    );

    return {
      applications,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async getEmployerStats(employer: AuthenticatedEmployer, query: EmployerApplicationStatsQuery = {}) {
    const match: Record<string, unknown> = {
      employerId: new mongoose.Types.ObjectId(employer.employerId),
      companyId: new mongoose.Types.ObjectId(employer.companyId),
    };

    if (query.jobId) {
      const ownedJob = await Job.findOne({
        _id: query.jobId,
        employerId: employer.employerId,
        companyId: employer.companyId,
        deletedAt: null,
      }).select('_id');
      if (!ownedJob) {
        throw new AppError('Job not found', HTTP_STATUS.NOT_FOUND);
      }
      match.jobId = ownedJob._id;
    }

    const rows = await Application.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const byStatus: Record<string, number> = {
      applied: 0,
      viewed: 0,
      shortlisted: 0,
      interview: 0,
      rejected: 0,
      hired: 0,
      withdrawn: 0,
    };
    let total = 0;
    for (const row of rows) {
      byStatus[row._id] = row.count;
      total += row.count;
    }

    return {
      total,
      byStatus,
      /** UI-friendly aliases used by employer applicants page. */
      counts: {
        all: total,
        new: byStatus.applied,
        reviewing: byStatus.viewed,
        shortlisted: byStatus.shortlisted,
        interview: byStatus.interview,
        selected: byStatus.hired,
        rejected: byStatus.rejected,
        withdrawn: byStatus.withdrawn,
      },
    };
  }

  async getEmployerById(employer: AuthenticatedEmployer, id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }

    const application = await Application.findOne({
      _id: id,
      employerId: employer.employerId,
      companyId: employer.companyId,
    });
    if (!application) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }

    // First open by employer → mark viewed + notify candidate (atomic to avoid double notify).
    if (application.status === 'applied') {
      const actorName = await resolveEmployerActorName(employer);
      const claimed = await Application.findOneAndUpdate(
        {
          _id: application._id,
          employerId: employer.employerId,
          companyId: employer.companyId,
          status: 'applied',
        },
        {
          $set: { status: 'viewed', viewedAt: new Date() },
          $push: {
            statusHistory: {
              $each: [
                {
                  from: 'applied',
                  to: 'viewed',
                  at: new Date(),
                  byUserId: new mongoose.Types.ObjectId(employer.userId),
                  byName: actorName,
                  auto: true,
                },
              ],
              $slice: -50,
            },
          },
        },
        { new: true },
      );

      if (claimed) {
        application.status = claimed.status;
        application.viewedAt = claimed.viewedAt;
        application.statusHistory = claimed.statusHistory;

        await trackSafely({
          eventType: 'application_status_changed',
          userId: employer.userId,
          actorRole: 'employer',
          entityType: 'application',
          entityId: application._id,
          jobId: application.jobId,
          companyId: application.companyId,
          employerId: application.employerId,
          candidateId: application.candidateId,
          metadata: { from: 'applied', to: 'viewed', auto: true },
        });

        const candidateUserId = await resolveCandidateUserId(application.candidateId);
        if (candidateUserId) {
          const jobTitle = (
            await Job.findById(application.jobId).select('title')
          )?.title;
          await notifySafely({
            recipientId: candidateUserId,
            type: 'RECRUITER_VIEWED_PROFILE',
            title: 'Recruiter Viewed Your Profile',
            message: jobTitle
              ? `A recruiter viewed your profile for "${jobTitle}".`
              : 'A recruiter viewed your application profile.',
            data: {
              applicationId: application._id.toString(),
              jobId: application.jobId.toString(),
              employerId: employer.employerId,
              candidateId: application.candidateId.toString(),
              status: 'viewed',
            },
          });
        }
      } else {
        // Another request already transitioned — reload current state.
        const fresh = await Application.findById(application._id);
        if (fresh) {
          application.status = fresh.status;
          application.viewedAt = fresh.viewedAt;
          application.shortlistedAt = fresh.shortlistedAt;
          application.interviewAt = fresh.interviewAt;
          application.rejectedAt = fresh.rejectedAt;
          application.hiredAt = fresh.hiredAt;
          application.statusHistory = fresh.statusHistory;
          application.internalNotes = fresh.internalNotes;
          application.notes = fresh.notes;
        }
      }
    }

    const job = await Job.findById(application.jobId).select(
      'title slug status workMode employmentType skills requirements experienceMin experienceMax salaryMin salaryMax location',
    );
    const candidateView = await loadEmployerCandidateView(application.candidateId);

    return {
      application: mapEmployerApplication(application, {
        job: job
          ? {
              id: job._id.toString(),
              title: job.title,
              slug: job.slug,
              status: job.status,
              workMode: job.workMode,
              employmentType: job.employmentType,
            }
          : null,
        candidate: candidateView,
        match: job && candidateView ? matchFor(job, candidateView) : null,
      }),
    };
  }

  async updateStatus(
    employer: AuthenticatedEmployer,
    id: string,
    input: ApplicationStatusUpdateInput,
  ) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }

    const application = await Application.findOne({
      _id: id,
      employerId: employer.employerId,
      companyId: employer.companyId,
    });
    if (!application) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }

    const from = application.status as ApplicationStatus;
    const to = input.status as ApplicationStatus;

    if (!canEmployerTransition(from, to)) {
      throw new AppError(
        `Cannot transition application from "${from}" to "${to}"`,
        HTTP_STATUS.CONFLICT,
      );
    }

    const actorName = await resolveEmployerActorName(employer);
    application.status = to;
    const stamp = employerTimestampField(to);
    if (stamp) {
      application[stamp] = new Date();
    }
    pushStatusHistory(application as never, from, to, {
      userId: employer.userId,
      name: actorName,
    });
    await application.save();

    await trackSafely({
      eventType: 'application_status_changed',
      userId: employer.userId,
      actorRole: 'employer',
      entityType: 'application',
      entityId: application._id,
      jobId: application.jobId,
      companyId: application.companyId,
      employerId: application.employerId,
      candidateId: application.candidateId,
      metadata: { from, to },
    });

    const candidateUserId = await resolveCandidateUserId(application.candidateId);
    if (candidateUserId) {
      const job = await Job.findById(application.jobId).select('title');
      await notifySafely({
        recipientId: candidateUserId,
        type: 'APPLICATION_STATUS_CHANGED',
        title: 'Application Status Updated',
        message: job
          ? `Your application for "${job.title}" is now ${to}.`
          : `Your application status is now ${to}.`,
        data: {
          applicationId: application._id.toString(),
          jobId: application.jobId.toString(),
          status: to,
        },
      });
    }

    // 305 — Employer feed when a candidate is shortlisted.
    if (to === 'shortlisted') {
      const employerUserId = await resolveEmployerUserId(application.employerId);
      if (employerUserId) {
        const [job, candidateDoc] = await Promise.all([
          Job.findById(application.jobId).select('title'),
          Candidate.findById(application.candidateId).select('userId'),
        ]);
        const candidateUser = candidateDoc
          ? await User.findById(candidateDoc.userId).select('name')
          : null;
        const name = candidateUser?.name?.trim() || 'A candidate';
        await notifySafely({
          recipientId: employerUserId,
          type: 'APPLICATION_SHORTLISTED',
          title: 'Candidate shortlisted',
          message: job
            ? `${name} was shortlisted for "${job.title}".`
            : `${name} was shortlisted.`,
          data: {
            applicationId: application._id.toString(),
            jobId: application.jobId.toString(),
            candidateId: application.candidateId.toString(),
            status: to,
          },
        });
      }
    }

    return this.getEmployerById(employer, id);
  }

  async bulkUpdateStatus(
    employer: AuthenticatedEmployer,
    input: ApplicationBulkStatusInput,
  ) {
    const results: Array<{
      id: string;
      ok: boolean;
      error?: string;
      status?: string;
    }> = [];

    for (const id of input.ids) {
      try {
        const data = await this.updateStatus(employer, id, { status: input.status });
        results.push({
          id,
          ok: true,
          status: data.application.status as string,
        });
      } catch (error) {
        results.push({
          id,
          ok: false,
          error: error instanceof AppError ? error.message : 'Update failed',
        });
      }
    }

    const updated = results.filter((r) => r.ok).length;
    return {
      requested: input.ids.length,
      updated,
      failed: input.ids.length - updated,
      status: input.status,
      results,
    };
  }

  /** Bulk message selected applicants via chat (sheet 268). */
  async bulkMessage(employer: AuthenticatedEmployer, input: ApplicationBulkMessageInput) {
    const actor = {
      userId: employer.userId,
      role: 'employer' as const,
      employerId: employer.employerId,
      companyId: employer.companyId,
    };
    const results: Array<{ id: string; ok: boolean; error?: string; conversationId?: string }> =
      [];

    for (const id of input.ids) {
      try {
        const application = await Application.findOne({
          _id: id,
          employerId: employer.employerId,
          companyId: employer.companyId,
        }).select('status');
        if (!application) {
          results.push({ id, ok: false, error: 'Application not found' });
          continue;
        }
        // Ensure chat-eligible: auto-view applied apps first
        if (application.status === 'applied') {
          await this.getEmployerById(employer, id);
        }
        const opened = await chatService.openOrGetForApplication(actor, id);
        const conversationId = opened.id as string;
        await chatService.sendMessage(actor, conversationId, {
          body: input.body,
          type: 'text',
        });
        results.push({ id, ok: true, conversationId });
      } catch (error) {
        results.push({
          id,
          ok: false,
          error: error instanceof AppError ? error.message : 'Message failed',
        });
      }
    }

    const sent = results.filter((r) => r.ok).length;
    return {
      requested: input.ids.length,
      sent,
      failed: input.ids.length - sent,
      results,
    };
  }

  /** CSV export of applicants (sheet 271). */
  async exportEmployerCsv(
    employer: AuthenticatedEmployer,
    query: EmployerApplicationExportQuery = {},
  ) {
    const list = await this.listEmployer(
      employer,
      {
        page: 1,
        limit: 100,
        status: query.status,
        jobId: query.jobId,
        q: query.q,
      },
    );

    // Fetch up to 500 by paging if needed
    const rows = [...list.applications];
    let page = 2;
    while (rows.length < list.pagination.total && page <= 5) {
      const next = await this.listEmployer(employer, {
        page,
        limit: 100,
        status: query.status,
        jobId: query.jobId,
        q: query.q,
      });
      rows.push(...next.applications);
      if (next.applications.length === 0) break;
      page += 1;
    }

    const escape = (value: unknown) => {
      const raw = value == null ? '' : String(value);
      if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
      return raw;
    };

    const header = [
      'applicationId',
      'candidateName',
      'email',
      'phone',
      'jobTitle',
      'status',
      'matchPercent',
      'experienceYears',
      'location',
      'skills',
      'appliedAt',
      'answers',
    ];
    const lines = [header.join(',')];
    for (const app of rows) {
      const candidate = app.candidate as Record<string, unknown> | null;
      const job = app.job as Record<string, unknown> | null;
      const match = app.match as { overall?: number } | null;
      const answers = Array.isArray(app.answers)
        ? (app.answers as Array<{ question?: string; answer?: string }>)
            .map((a) => `${a.question ?? ''}: ${a.answer ?? ''}`)
            .join(' | ')
        : '';
      lines.push(
        [
          app.id,
          candidate?.name,
          candidate?.email,
          candidate?.phone,
          job?.title,
          app.status,
          match?.overall != null ? Math.round(match.overall) : '',
          candidate?.totalExperience,
          candidate?.currentLocation,
          Array.isArray(candidate?.skills) ? (candidate?.skills as string[]).join('; ') : '',
          app.appliedAt,
          answers,
        ]
          .map(escape)
          .join(','),
      );
    }

    return {
      filename: `applicants-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: 'text/csv; charset=utf-8',
      csv: `${lines.join('\n')}\n`,
      total: rows.length,
    };
  }

  async addNote(
    employer: AuthenticatedEmployer,
    id: string,
    input: ApplicationNotesUpdateInput,
  ) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }
    const application = await Application.findOne({
      _id: id,
      employerId: employer.employerId,
      companyId: employer.companyId,
    });
    if (!application) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }

    const actorName = await resolveEmployerActorName(employer);
    application.internalNotes.push({
      text: input.text,
      authorUserId: new mongoose.Types.ObjectId(employer.userId),
      authorName: actorName,
      createdAt: new Date(),
    } as never);
    application.notes = input.text;
    await application.save();
    return this.getEmployerById(employer, id);
  }

  async setInternalRating(
    employer: AuthenticatedEmployer,
    id: string,
    input: ApplicationInternalRatingInput,
  ) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }
    const application = await Application.findOne({
      _id: id,
      employerId: employer.employerId,
      companyId: employer.companyId,
    });
    if (!application) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }

    application.internalRating = input.rating;
    await application.save();
    return this.getEmployerById(employer, id);
  }

  async updateNote(
    employer: AuthenticatedEmployer,
    id: string,
    noteId: string,
    input: ApplicationNotesUpdateInput,
  ) {
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(noteId)) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }
    const application = await Application.findOne({
      _id: id,
      employerId: employer.employerId,
      companyId: employer.companyId,
    });
    if (!application) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }

    const note = application.internalNotes.id(noteId);
    if (!note) {
      // Legacy single-string note: replace notes field when noteId is sentinel
      if (noteId === '000000000000000000000000' || application.internalNotes.length === 0) {
        application.notes = input.text;
        application.internalNotes.push({
          text: input.text,
          authorUserId: new mongoose.Types.ObjectId(employer.userId),
          authorName: await resolveEmployerActorName(employer),
          createdAt: new Date(),
        } as never);
        await application.save();
        return this.getEmployerById(employer, id);
      }
      throw new AppError('Note not found', HTTP_STATUS.NOT_FOUND);
    }

    note.text = input.text;
    note.updatedAt = new Date();
    application.notes = input.text;
    await application.save();
    return this.getEmployerById(employer, id);
  }

  async deleteNote(employer: AuthenticatedEmployer, id: string, noteId: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }
    const application = await Application.findOne({
      _id: id,
      employerId: employer.employerId,
      companyId: employer.companyId,
    });
    if (!application) {
      throw new AppError('Application not found', HTTP_STATUS.NOT_FOUND);
    }

    if (mongoose.Types.ObjectId.isValid(noteId)) {
      const note = application.internalNotes.id(noteId);
      if (note) {
        note.deleteOne();
      } else if (application.internalNotes.length === 0 && application.notes) {
        application.notes = '';
      } else {
        throw new AppError('Note not found', HTTP_STATUS.NOT_FOUND);
      }
    } else if (noteId === 'server-note') {
      application.notes = '';
      application.internalNotes.splice(0);
    } else {
      throw new AppError('Note not found', HTTP_STATUS.NOT_FOUND);
    }

    const latest = application.internalNotes[application.internalNotes.length - 1];
    application.notes = latest?.text ?? '';
    await application.save();
    return this.getEmployerById(employer, id);
  }
}

export const applicationService = new ApplicationService();
