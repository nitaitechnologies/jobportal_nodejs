import type { InterviewStatus } from '../constants/enums';

/** Active (non-terminal) interview statuses. */
export const ACTIVE_INTERVIEW_STATUSES: InterviewStatus[] = [
  'scheduled',
  'confirmed',
  'rescheduled',
];

const TRANSITIONS: Record<InterviewStatus, InterviewStatus[]> = {
  scheduled: ['confirmed', 'rescheduled', 'cancelled', 'declined', 'completed', 'no-show'],
  confirmed: ['rescheduled', 'completed', 'cancelled', 'no-show'],
  rescheduled: ['confirmed', 'completed', 'cancelled', 'declined', 'no-show'],
  completed: [],
  cancelled: [],
  declined: [],
  'no-show': [],
};

export function isTerminalInterviewStatus(status: InterviewStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}

export function isActiveInterviewStatus(status: InterviewStatus): boolean {
  return ACTIVE_INTERVIEW_STATUSES.includes(status);
}

export function canTransitionInterviewStatus(
  from: InterviewStatus,
  to: InterviewStatus,
): boolean {
  if (from === to) {
    return false;
  }
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function canCandidateConfirm(status: InterviewStatus): boolean {
  return canTransitionInterviewStatus(status, 'confirmed');
}

export function canCandidateDecline(status: InterviewStatus): boolean {
  return canTransitionInterviewStatus(status, 'declined');
}

export function canEmployerCancel(status: InterviewStatus): boolean {
  return canTransitionInterviewStatus(status, 'cancelled');
}

export function canEmployerReschedule(status: InterviewStatus): boolean {
  return (
    status === 'scheduled' ||
    status === 'confirmed' ||
    status === 'rescheduled' ||
    canTransitionInterviewStatus(status, 'rescheduled')
  );
}

export function canEmployerComplete(status: InterviewStatus): boolean {
  return canTransitionInterviewStatus(status, 'completed');
}
