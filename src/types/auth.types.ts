import type { AdminRole, UserRole } from '../constants/enums';

/** Minimal JWT claims — no secrets or PII beyond stable IDs. */
export interface AccessTokenPayload {
  userId: string;
  role: UserRole;
  /** Present for admin tokens only. */
  adminUserId?: string;
}

/** Identity attached after JWT verification. */
export interface AuthenticatedIdentity {
  userId: string;
  role: UserRole;
  adminUserId?: string;
}

/** Admin context attached after authorization checks. */
export interface AuthenticatedAdmin {
  adminUserId: string;
  userId: string;
  name: string;
  email: string;
  role: AdminRole;
  permissions: string[];
  status: string;
}

/** Candidate context attached after authorization checks. */
export interface AuthenticatedCandidate {
  userId: string;
  candidateId: string;
  name: string;
  email: string;
  phone: string;
  role: 'candidate';
  status: string;
}

/** Employer context attached after authorization checks. */
export interface AuthenticatedEmployer {
  userId: string;
  employerId: string;
  companyId: string;
  name: string;
  email: string;
  phone: string;
  role: 'employer';
  status: string;
}
