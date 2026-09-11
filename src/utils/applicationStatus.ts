import type { ApplicationStatus } from '../constants/enums';

/** Employer-driven transitions (candidate may only withdraw). */
const EMPLOYER_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  applied: ['viewed', 'shortlisted', 'rejected'],
  viewed: ['shortlisted', 'rejected'],
  shortlisted: ['interview', 'hired', 'rejected'],
  interview: ['hired', 'rejected'],
  rejected: [],
  hired: [],
  withdrawn: [],
};

const CANDIDATE_WITHDRAW_FROM: ApplicationStatus[] = ['applied', 'viewed', 'shortlisted'];

export function canCandidateWithdraw(status: ApplicationStatus): boolean {
  return CANDIDATE_WITHDRAW_FROM.includes(status);
}

export function canEmployerTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return EMPLOYER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalApplicationStatus(status: ApplicationStatus): boolean {
  return status === 'rejected' || status === 'hired' || status === 'withdrawn';
}

export function employerTimestampField(
  status: ApplicationStatus,
): 'viewedAt' | 'shortlistedAt' | 'rejectedAt' | 'hiredAt' | null {
  switch (status) {
    case 'viewed':
      return 'viewedAt';
    case 'shortlisted':
      return 'shortlistedAt';
    case 'rejected':
      return 'rejectedAt';
    case 'hired':
      return 'hiredAt';
    default:
      return null;
  }
}
