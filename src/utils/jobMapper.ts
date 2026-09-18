import type { Types } from 'mongoose';
import { env } from '../config/env';

export interface JobLocationLike {
  locationId?: Types.ObjectId | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  area?: string | null;
  displayName?: string | null;
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
  genderPreference?: string | null;
  benefits?: string[] | null;
  applicationDeadline?: Date | null;
  applicationMethod?: string | null;
  status?: string;
  featured?: boolean | null;
  urgent?: boolean | null;
  views?: number | null;
  applicationsCount?: number | null;
  publishedAt?: Date | null;
  expiresAt?: Date | null;
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
  };
}

function mapCoreJob(job: JobLike) {
  const videoJd =
    env.enableVideoJd && job.videoJd?.trim() ? job.videoJd.trim() : '';
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
    genderPreference: job.genderPreference ?? 'any',
    benefits: job.benefits ?? [],
    deadline: job.applicationDeadline ?? null,
    applicationMethod: job.applicationMethod ?? 'platform',
    status: job.status,
    featured: Boolean(job.featured),
    urgent: Boolean(job.urgent),
    views: job.views ?? 0,
    applicationsCount: job.applicationsCount ?? 0,
    publishedAt: job.publishedAt ?? null,
    expiresAt: job.expiresAt ?? null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export function mapEmployerJob(
  job: JobLike,
  extras?: {
    category?: JobCategorySummary | null;
    company?: JobCompanySummary | null;
  },
) {
  return {
    ...mapCoreJob(job),
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
    benefits: core.benefits,
    deadline: core.deadline,
    applicationMethod: core.applicationMethod,
    featured: core.featured,
    urgent: core.urgent,
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
        }
      : null,
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
}

export function mapPublicJobSummary(
  job: JobLike,
  extras?: {
    category?: JobCategorySummary | null;
    company?: JobCompanySummary | null;
    location?: JobLocationSummary | null;
  },
) {
  return {
    id: job._id.toString(),
    title: job.title,
    slug: job.slug,
    skills: job.skills ?? [],
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
    publishedAt: job.publishedAt ?? null,
    company: extras?.company
      ? {
          id: extras.company.id,
          name: extras.company.name,
          slug: extras.company.slug,
          logo: extras.company.logo ?? '',
          industry: extras.company.industry ?? '',
        }
      : null,
  };
}
