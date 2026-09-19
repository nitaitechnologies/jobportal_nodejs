import type { Types } from 'mongoose';
import { env } from '../config/env';

export interface ApplicationLike {
  _id: Types.ObjectId | { toString(): string };
  candidateId: Types.ObjectId | { toString(): string };
  jobId: Types.ObjectId | { toString(): string };
  employerId: Types.ObjectId | { toString(): string };
  companyId: Types.ObjectId | { toString(): string };
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
  notes?: string | null;
  source?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export function mapCandidateApplication(
  application: ApplicationLike,
  extras?: {
    job?: Record<string, unknown> | null;
    company?: Record<string, unknown> | null;
  },
) {
  const videoRaw = application.videoResume ?? '';
  return {
    id: application._id.toString(),
    jobId: application.jobId.toString(),
    status: application.status,
    coverLetter: application.coverLetter ?? '',
    resume: application.resume ?? '',
    hasVideoResume: env.enableVideoResume && Boolean(videoRaw.trim()),
    answers: application.answers ?? [],
    appliedAt: application.appliedAt ?? application.createdAt ?? null,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    job: extras?.job ?? null,
    company: extras?.company ?? null,
  };
}

export function mapEmployerApplication(
  application: ApplicationLike,
  extras?: {
    job?: Record<string, unknown> | null;
    candidate?: Record<string, unknown> | null;
    match?: Record<string, unknown> | null;
  },
) {
  const resumeRaw = application.resume ?? '';
  const resume =
    resumeRaw.startsWith('media:') || (resumeRaw && !/^https?:\/\//i.test(resumeRaw))
      ? '[resume on file]'
      : resumeRaw;
  const videoRaw = application.videoResume ?? '';

  return {
    id: application._id.toString(),
    jobId: application.jobId.toString(),
    candidateId: application.candidateId.toString(),
    status: application.status,
    coverLetter: application.coverLetter ?? '',
    resume,
    hasResume: Boolean(resumeRaw.trim()),
    hasVideoResume: env.enableVideoResume && Boolean(videoRaw.trim()),
    answers: application.answers ?? [],
    appliedAt: application.appliedAt ?? application.createdAt ?? null,
    viewedAt: application.viewedAt ?? null,
    shortlistedAt: application.shortlistedAt ?? null,
    rejectedAt: application.rejectedAt ?? null,
    hiredAt: application.hiredAt ?? null,
    notes: application.notes ?? '',
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    job: extras?.job ?? null,
    candidate: extras?.candidate ?? null,
    match: extras?.match ?? null,
  };
}
