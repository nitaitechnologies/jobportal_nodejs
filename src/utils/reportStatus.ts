import type { ReportStatus } from '../constants/enums';

const TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  pending: ['reviewing', 'resolved', 'dismissed'],
  reviewing: ['resolved', 'dismissed', 'pending'],
  resolved: [],
  dismissed: [],
};

export function canTransitionReportStatus(from: ReportStatus, to: ReportStatus): boolean {
  if (from === to) {
    return true;
  }
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalReportStatus(status: ReportStatus): boolean {
  return status === 'resolved' || status === 'dismissed';
}

export const ACTIVE_REPORT_STATUSES: ReportStatus[] = ['pending', 'reviewing'];
