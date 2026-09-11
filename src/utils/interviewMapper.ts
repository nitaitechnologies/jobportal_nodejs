import type { Types } from 'mongoose';

export interface InterviewLike {
  _id: Types.ObjectId | { toString(): string };
  applicationId: Types.ObjectId | { toString(): string };
  candidateId: Types.ObjectId | { toString(): string };
  employerId: Types.ObjectId | { toString(): string };
  companyId: Types.ObjectId | { toString(): string };
  jobId: Types.ObjectId | { toString(): string };
  type: string;
  scheduledAt: Date;
  duration?: number | null;
  location?: string | null;
  meetingLink?: string | null;
  interviewer?: string | null;
  notes?: string | null;
  status?: string;
  cancellationReason?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

function mapInterviewCore(interview: InterviewLike) {
  return {
    id: interview._id.toString(),
    applicationId: interview.applicationId.toString(),
    candidateId: interview.candidateId.toString(),
    employerId: interview.employerId.toString(),
    companyId: interview.companyId.toString(),
    jobId: interview.jobId.toString(),
    type: interview.type,
    scheduledAt: interview.scheduledAt,
    duration: interview.duration ?? 30,
    location: interview.location ?? '',
    meetingLink: interview.meetingLink ?? '',
    interviewer: interview.interviewer ?? '',
    notes: interview.notes ?? '',
    status: interview.status ?? 'scheduled',
    cancellationReason: interview.cancellationReason ?? '',
    createdAt: interview.createdAt,
    updatedAt: interview.updatedAt,
  };
}

export function mapEmployerInterview(
  interview: InterviewLike,
  extras?: {
    job?: Record<string, unknown> | null;
    application?: Record<string, unknown> | null;
    candidate?: Record<string, unknown> | null;
    company?: Record<string, unknown> | null;
  },
) {
  return {
    ...mapInterviewCore(interview),
    job: extras?.job ?? null,
    application: extras?.application ?? null,
    candidate: extras?.candidate ?? null,
    company: extras?.company ?? null,
  };
}

export function mapCandidateInterview(
  interview: InterviewLike,
  extras?: {
    job?: Record<string, unknown> | null;
    application?: Record<string, unknown> | null;
    company?: Record<string, unknown> | null;
  },
) {
  const core = mapInterviewCore(interview);
  return {
    id: core.id,
    applicationId: core.applicationId,
    jobId: core.jobId,
    companyId: core.companyId,
    type: core.type,
    scheduledAt: core.scheduledAt,
    duration: core.duration,
    location: core.location,
    meetingLink: core.meetingLink,
    interviewer: core.interviewer,
    notes: core.notes,
    status: core.status,
    cancellationReason: core.cancellationReason,
    createdAt: core.createdAt,
    updatedAt: core.updatedAt,
    job: extras?.job ?? null,
    application: extras?.application ?? null,
    company: extras?.company ?? null,
  };
}
