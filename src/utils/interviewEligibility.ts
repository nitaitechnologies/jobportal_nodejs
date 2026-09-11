import type { ApplicationStatus } from '../constants/enums';

/** Application statuses that may receive a new interview (aligned with B14). */
export const INTERVIEW_ELIGIBLE_APPLICATION_STATUSES: ApplicationStatus[] = [
  'shortlisted',
  'interview',
];

export function isApplicationEligibleForInterview(status: ApplicationStatus): boolean {
  return INTERVIEW_ELIGIBLE_APPLICATION_STATUSES.includes(status);
}

/**
 * When an interview is created, move shortlisted applications to `interview`.
 * Applications already in `interview` stay unchanged.
 */
export function applicationStatusAfterInterviewCreate(
  status: ApplicationStatus,
): ApplicationStatus {
  if (status === 'shortlisted') {
    return 'interview';
  }
  return status;
}
