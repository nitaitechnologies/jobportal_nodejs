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
  interviewAt?: Date | null;
  rejectedAt?: Date | null;
  hiredAt?: Date | null;
  notes?: string | null;
  internalNotes?: Array<{
    _id?: { toString(): string };
    text?: string;
    authorName?: string | null;
    authorUserId?: { toString(): string } | null;
    createdAt?: Date | null;
    updatedAt?: Date | null;
  }> | null;
  internalRating?: number | null;
  source?: string | null;
  assignedEmployerId?: Types.ObjectId | { toString(): string } | null;
  statusHistory?: Array<{
    from?: string;
    to?: string;
    at?: Date | null;
    byName?: string | null;
    auto?: boolean | null;
  }> | null;
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
    viewedAt: application.viewedAt ?? null,
    shortlistedAt: application.shortlistedAt ?? null,
    interviewAt: application.interviewAt ?? null,
    rejectedAt: application.rejectedAt ?? null,
    hiredAt: application.hiredAt ?? null,
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
    interviewAt: application.interviewAt ?? null,
    rejectedAt: application.rejectedAt ?? null,
    hiredAt: application.hiredAt ?? null,
    notes: application.notes ?? '',
    internalNotes: (application.internalNotes ?? []).map((note) => ({
      id: note._id?.toString() ?? '',
      text: note.text ?? '',
      authorName: note.authorName ?? 'Hiring team',
      authorUserId: note.authorUserId?.toString() ?? null,
      createdAt: note.createdAt ?? null,
      updatedAt: note.updatedAt ?? null,
    })),
    internalRating:
      typeof application.internalRating === 'number' ? application.internalRating : null,
    source: application.source ?? 'platform',
    assignedEmployerId: application.assignedEmployerId
      ? application.assignedEmployerId.toString()
      : null,
    statusHistory: (application.statusHistory ?? []).map((entry) => ({
      from: entry.from ?? '',
      to: entry.to ?? '',
      at: entry.at ?? null,
      byName: entry.byName ?? '',
      auto: Boolean(entry.auto),
    })),
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    job: extras?.job ?? null,
    candidate: extras?.candidate ?? null,
    match: extras?.match ?? null,
  };
}
