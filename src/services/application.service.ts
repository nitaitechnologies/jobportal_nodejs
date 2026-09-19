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
import type {
  ApplicationApplyInput,
  ApplicationStatusUpdateInput,
  CandidateApplicationQuery,
  EmployerApplicationQuery,
} from '../validators/application.validator';

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
    const { MediaFile } = await import('../models/MediaFile.js');
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
  const { env } = await import('../config/env.js');
  if (!env.enableVideoResume) return '';

  const fallback = candidateVideoResume?.trim() ?? '';
  const requested = inputVideoResume?.trim() ?? '';
  if (!requested) return fallback;

  if (requested.startsWith('media:')) {
    const mediaId = requested.slice('media:'.length);
    if (!mongoose.Types.ObjectId.isValid(mediaId)) {
      throw new AppError('Invalid video resume reference', HTTP_STATUS.BAD_REQUEST);
    }
    const { MediaFile } = await import('../models/MediaFile.js');
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

    try {
      const application = await Application.create({
        candidateId: new mongoose.Types.ObjectId(candidate.candidateId),
        jobId: job._id,
        employerId: job.employerId,
        companyId: job.companyId,
        resume,
        videoResume,
        coverLetter: input.coverLetter ?? '',
        answers: input.answers ?? [],
        status: 'applied',
        appliedAt: new Date(),
        source: 'platform',
      });

      await Job.updateOne({ _id: job._id }, { $inc: { applicationsCount: 1 } });

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
      }

      const extras = await loadJobPublicExtras(job);
      return {
        application: mapCandidateApplication(application, extras),
      };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AppError('You have already applied to this job', HTTP_STATUS.CONFLICT);
      }
      throw error;
    }
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

    application.status = to;
    const stamp = employerTimestampField(to);
    if (stamp) {
      application[stamp] = new Date();
    }
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

    return this.getEmployerById(employer, id);
  }
}

export const applicationService = new ApplicationService();
