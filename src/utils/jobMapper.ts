import type { Types } from 'mongoose';
import { env } from '../config/env';
import { computeJobSafetyHints, type JobSafetyHints } from './jobSafety';

export type { JobSafetyHints };
export interface JobLocationLike {
  locationId?: Types.ObjectId | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  area?: string | null;
  displayName?: string | null;
  address?: string | null;
  placeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface JobLike {
  _id: Types.ObjectId | { toString(): string };
  companyId: Types.ObjectId | { toString(): string };
  employerId: Types.ObjectId | { toString(): string };
  title: string;
  slug: string;
  description: string;
  videoJd?: string | null;
  responsibilities?: string[] | null;
  requirements?: string[] | null;
  skills?: string[] | null;
  categoryId?: Types.ObjectId | null;
  location?: JobLocationLike | null;
  workMode: string;
  employmentType: string;
  experienceMin?: number | null;
  experienceMax?: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryPeriod?: string | null;
  openings?: number | null;
  education?: string | null;
  screeningQuestions?: Array<{
    id: string;
    text: string;
    required?: boolean;
    type?: string;
  }> | null;
  screeningAutoFilter?: {
    enabled?: boolean | null;
    minMatchScore?: number | null;
  } | null;
  shift?: string | null;
  workingDays?: string[] | null;
  workingHours?: string | null;
  genderPreference?: string | null;
  benefits?: string[] | null;
  incentives?: boolean | null;
  interviewProcess?: string | null;
  applicationDeadline?: Date | null;
  applicationMethod?: string | null;
  status?: string;
  featured?: boolean | null;
  urgent?: boolean | null;
  featuredAt?: Date | null;
  boostBaseline?: {
    views?: number | null;
    applicationsCount?: number | null;
    capturedAt?: Date | null;
  } | null;
  boostNotifySentAt?: Date | null;
  boostNotifyCount?: number | null;
  views?: number | null;
  applicationsCount?: number | null;
  publishedAt?: Date | null;
  expiresAt?: Date | null;
  assignedEmployerIds?: Array<Types.ObjectId | { toString(): string }> | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface JobCategorySummary {
  id: string;
  name: string;
  slug: string;
}

export interface JobCompanySummary {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  industry?: string;
  companySize?: string | null;
  headquarters?: string;
  verificationStatus?: string;
  /** Convenience boolean for verified company badge (sheet 141). */
  verified?: boolean;
  /** Present on public job detail when employer published a contact number. */
  contactPhone?: string;
}

function mapLocation(location?: JobLocationLike | null) {
  if (!location) {
    return null;
  }
  return {
    locationId: location.locationId ? location.locationId.toString() : null,
    city: location.city ?? '',
    state: location.state ?? '',
    country: location.country ?? '',
    area: location.area ?? '',
    displayName: location.displayName ?? '',
    address: location.address ?? '',
    placeId: location.placeId ?? '',
    latitude: typeof location.latitude === 'number' ? location.latitude : null,
    longitude: typeof location.longitude === 'number' ? location.longitude : null,
  };
}

function mapCoreJob(
  job: JobLike,
  options?: { /** Admin moderation must see video even when public flag is off. */ includeVideoJd?: boolean },
) {
  const allowVideo = options?.includeVideoJd === true || env.enableVideoJd;
  const videoJd = allowVideo && job.videoJd?.trim() ? job.videoJd.trim() : '';
  return {
    id: job._id.toString(),
    title: job.title,
    slug: job.slug,
    description: job.description,
    videoJd,
    hasVideoJd: Boolean(videoJd),
    responsibilities: job.responsibilities ?? [],
    requirements: job.requirements ?? [],
    skills: job.skills ?? [],
    categoryId: job.categoryId ? job.categoryId.toString() : null,
    location: mapLocation(job.location),
    workMode: job.workMode,
    employmentType: job.employmentType,
    experience: {
      min: job.experienceMin ?? 0,
      max: job.experienceMax ?? null,
    },
    salary: {
      min: job.salaryMin ?? null,
      max: job.salaryMax ?? null,
      period: job.salaryPeriod ?? 'monthly',
    },
    openings: job.openings ?? 1,
    education: job.education ?? '',
    screeningQuestions: (job.screeningQuestions ?? []).map((q) => ({
      id: q.id,
      text: q.text,
      required: Boolean(q.required),
      type: q.type ?? 'text',
    })),
    screeningAutoFilter: {
      enabled: Boolean(job.screeningAutoFilter?.enabled),
      minMatchScore:
        typeof job.screeningAutoFilter?.minMatchScore === 'number'
          ? job.screeningAutoFilter.minMatchScore
          : 40,
    },
    shift: job.shift ?? null,
    workingDays: job.workingDays ?? [],
    workingHours: job.workingHours ?? '',
    genderPreference: job.genderPreference ?? 'any',
    benefits: job.benefits ?? [],
    incentives: Boolean(job.incentives),
    interviewProcess: job.interviewProcess ?? '',
    deadline: job.applicationDeadline ?? null,
    applicationMethod: job.applicationMethod ?? 'platform',
    status: job.status,
    featured: Boolean(job.featured),
    urgent: Boolean(job.urgent),
    featuredAt: job.featuredAt ?? null,
    boostNotifySentAt: job.boostNotifySentAt ?? null,
    boostNotifyCount: job.boostNotifyCount ?? 0,
    views: job.views ?? 0,
    applicationsCount: job.applicationsCount ?? 0,
    publishedAt: job.publishedAt ?? null,
    expiresAt: job.expiresAt ?? null,
    assignedEmployerIds: (job.assignedEmployerIds ?? []).map((id) => id.toString()),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export function mapEmployerJob(
  job: JobLike,
  extras?: {
    category?: JobCategorySummary | null;
    company?: JobCompanySummary | null;
    /** When true, include videoJd even if ENABLE_VIDEO_JD is off (admin moderation). */
    includeVideoJd?: boolean;
  },
) {
  return {
    ...mapCoreJob(job, { includeVideoJd: extras?.includeVideoJd }),
    employerId: job.employerId.toString(),
    companyId: job.companyId.toString(),
    category: extras?.category ?? null,
    company: extras?.company ?? null,
  };
}

export function mapPublicJob(
  job: JobLike,
  extras?: {
    category?: JobCategorySummary | null;
    company?: JobCompanySummary | null;
    distanceKm?: number | null;
  },
) {
  const core = mapCoreJob(job);
  return {
    id: core.id,
    title: core.title,
    slug: core.slug,
    description: core.description,
    videoJd: core.videoJd,
    hasVideoJd: core.hasVideoJd,
    responsibilities: core.responsibilities,
    requirements: core.requirements,
    skills: core.skills,
    category: extras?.category ?? null,
    location: core.location,
    workMode: core.workMode,
    employmentType: core.employmentType,
    experience: core.experience,
    salary: core.salary,
    openings: core.openings,
    education: core.education,
    shift: core.shift,
    workingDays: core.workingDays,
    workingHours: core.workingHours,
    benefits: core.benefits,
    incentives: core.incentives,
    interviewProcess: core.interviewProcess,
    deadline: core.deadline,
    expiresAt: core.expiresAt,
    applicationMethod: core.applicationMethod,
    featured: core.featured,
    urgent: core.urgent,
    distanceKm: extras?.distanceKm ?? null,
    views: core.views,
    publishedAt: core.publishedAt,
    company: extras?.company
      ? {
          id: extras.company.id,
          name: extras.company.name,
          slug: extras.company.slug,
          logo: extras.company.logo ?? '',
          industry: extras.company.industry ?? '',
          companySize: extras.company.companySize ?? null,
          headquarters: extras.company.headquarters ?? '',
          verificationStatus: extras.company.verificationStatus ?? 'unverified',
          verified: extras.company.verificationStatus === 'verified',
          contactPhone: extras.company.contactPhone?.trim() || undefined,
        }
      : null,
    safetyHints: computeJobSafetyHints({
      title: job.title,
      description: job.description,
      responsibilities: job.responsibilities,
      requirements: job.requirements,
      applicationMethod: job.applicationMethod,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryPeriod: job.salaryPeriod,
      companyVerificationStatus: extras?.company?.verificationStatus,
    }),
  };
}

export interface JobLocationSummary {
  locationId: string | null;
  name?: string;
  slug?: string;
  type?: string;
  city: string;
  state: string;
  country: string;
  area: string;
  displayName: string;
  address?: string;
  placeId?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export function mapPublicJobSummary(
  job: JobLike,
  extras?: {
    category?: JobCategorySummary | null;
    company?: JobCompanySummary | null;
    location?: JobLocationSummary | null;
    distanceKm?: number | null;
  },
) {
  return {
    id: job._id.toString(),
    title: job.title,
    slug: job.slug,
    skills: job.skills ?? [],
    education: job.education ?? '',
    shift: job.shift ?? null,
    workingDays: job.workingDays ?? [],
    applicationMethod: job.applicationMethod ?? 'platform',
    category: extras?.category ?? null,
    location: extras?.location ?? mapLocation(job.location),
    workMode: job.workMode,
    employmentType: job.employmentType,
    experience: {
      min: job.experienceMin ?? 0,
      max: job.experienceMax ?? null,
    },
    salary: {
      min: job.salaryMin ?? null,
      max: job.salaryMax ?? null,
      period: job.salaryPeriod ?? 'monthly',
    },
    openings: job.openings ?? 1,
    featured: Boolean(job.featured),
    urgent: Boolean(job.urgent),
    distanceKm: extras?.distanceKm ?? null,
    publishedAt: job.publishedAt ?? null,
    company: extras?.company
      ? {
          id: extras.company.id,
          name: extras.company.name,
          slug: extras.company.slug,
          logo: extras.company.logo ?? '',
          industry: extras.company.industry ?? '',
          verificationStatus: extras.company.verificationStatus ?? 'unverified',
          verified: extras.company.verificationStatus === 'verified',
        }
      : null,
    safetyHints: computeJobSafetyHints({
      title: job.title,
      description: job.description,
      responsibilities: job.responsibilities,
      requirements: job.requirements,
      applicationMethod: job.applicationMethod,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryPeriod: job.salaryPeriod,
      companyVerificationStatus: extras?.company?.verificationStatus,
    }),
  };
}
