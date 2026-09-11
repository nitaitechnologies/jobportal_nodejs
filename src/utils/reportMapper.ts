import type { Types } from 'mongoose';

export interface ReportLike {
  _id: Types.ObjectId | { toString(): string };
  reporterId: Types.ObjectId | { toString(): string };
  targetType: string;
  targetId: Types.ObjectId | { toString(): string };
  reason: string;
  description?: string | null;
  status?: string;
  reviewedBy?: Types.ObjectId | { toString(): string } | null;
  reviewedAt?: Date | null;
  resolution?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

function mapCore(report: ReportLike) {
  return {
    id: report._id.toString(),
    targetType: report.targetType,
    targetId: report.targetId.toString(),
    reason: report.reason,
    description: report.description ?? '',
    status: report.status ?? 'pending',
    createdAt: report.createdAt ?? null,
    updatedAt: report.updatedAt ?? null,
  };
}

/** User-facing report — no reviewer internals beyond safe resolution outcome. */
export function mapUserReport(report: ReportLike) {
  const core = mapCore(report);
  const status = core.status;
  return {
    ...core,
    resolution:
      status === 'resolved' || status === 'dismissed' ? report.resolution ?? '' : '',
    reviewedAt:
      status === 'resolved' || status === 'dismissed' ? report.reviewedAt ?? null : null,
  };
}

export function mapAdminReport(
  report: ReportLike,
  extras?: {
    reporter?: Record<string, unknown> | null;
    target?: Record<string, unknown> | null;
    reviewer?: Record<string, unknown> | null;
  },
) {
  return {
    ...mapCore(report),
    resolution: report.resolution ?? '',
    reviewedBy: report.reviewedBy ? report.reviewedBy.toString() : null,
    reviewedAt: report.reviewedAt ?? null,
    reporter: extras?.reporter ?? null,
    target: extras?.target ?? null,
    reviewer: extras?.reviewer ?? null,
  };
}
