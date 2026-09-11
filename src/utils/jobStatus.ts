import type { JobStatus } from '../constants/enums';
import { HTTP_STATUS } from '../constants';
import { AppError } from './AppError';

/** Employer-driven transitions already used by B11. */
const EMPLOYER_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  draft: ['pending', 'published', 'closed'],
  pending: ['published', 'rejected', 'draft', 'closed'],
  published: ['paused', 'closed', 'expired'],
  paused: ['published', 'closed', 'expired'],
  closed: [],
  rejected: ['draft', 'pending'],
  expired: ['draft', 'closed', 'published'],
};

/**
 * Admin moderation transitions (B22).
 * Admin may act on any job; still must follow this matrix.
 */
const ADMIN_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  draft: ['pending', 'published', 'rejected', 'closed'],
  pending: ['published', 'rejected', 'closed'],
  published: ['paused', 'closed', 'expired'],
  paused: ['published', 'closed', 'expired'],
  closed: [],
  rejected: ['pending', 'draft'],
  expired: ['closed', 'draft', 'published'],
};

export function canAdminTransitionJob(from: JobStatus, to: JobStatus): boolean {
  if (from === to) return true;
  return (ADMIN_TRANSITIONS[from] ?? []).includes(to);
}

export function assertAdminJobTransition(from: JobStatus, to: JobStatus): void {
  if (!canAdminTransitionJob(from, to)) {
    throw new AppError(
      `Cannot transition job from "${from}" to "${to}"`,
      HTTP_STATUS.CONFLICT,
      [{ path: 'status', message: `Invalid transition ${from} → ${to}` }],
    );
  }
}

export function canEmployerTransitionJob(from: JobStatus, to: JobStatus): boolean {
  if (from === to) return true;
  return (EMPLOYER_TRANSITIONS[from] ?? []).includes(to);
}
