import type { Types } from 'mongoose';

export interface InvitationLike {
  _id: Types.ObjectId | { toString(): string };
  candidateId: Types.ObjectId | { toString(): string };
  jobId: Types.ObjectId | { toString(): string };
  employerId: Types.ObjectId | { toString(): string };
  companyId: Types.ObjectId | { toString(): string };
  message?: string | null;
  status?: string;
  expiresAt?: Date | null;
  respondedAt?: Date | null;
  applicationId?: Types.ObjectId | { toString(): string } | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export function mapInvitation(
  invitation: InvitationLike,
  extras?: {
    job?: Record<string, unknown> | null;
    company?: Record<string, unknown> | null;
    candidate?: Record<string, unknown> | null;
  },
) {
  return {
    id: invitation._id.toString(),
    candidateId: invitation.candidateId.toString(),
    jobId: invitation.jobId.toString(),
    employerId: invitation.employerId.toString(),
    companyId: invitation.companyId.toString(),
    message: invitation.message ?? '',
    status: invitation.status,
    expiresAt: invitation.expiresAt ?? null,
    respondedAt: invitation.respondedAt ?? null,
    applicationId: invitation.applicationId ? invitation.applicationId.toString() : null,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
    job: extras?.job ?? null,
    company: extras?.company ?? null,
    candidate: extras?.candidate ?? null,
  };
}
