import mongoose from 'mongoose';
import { CompanyActivityLog } from '../models/CompanyActivityLog';
import type { AuthenticatedEmployer } from '../types/auth.types';

export type CompanyActivityAction =
  | 'team.invite'
  | 'team.invite_revoked'
  | 'team.role_changed'
  | 'team.member_removed'
  | 'team.joined'
  | 'job.assigned'
  | 'application.assigned';

export async function recordCompanyActivity(input: {
  companyId: string;
  actorEmployerId: string;
  actorName?: string;
  action: CompanyActivityAction | string;
  entityType?: 'job' | 'application' | 'team' | 'invite' | 'system';
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  await CompanyActivityLog.create({
    companyId: new mongoose.Types.ObjectId(input.companyId),
    actorEmployerId: new mongoose.Types.ObjectId(input.actorEmployerId),
    actorName: (input.actorName ?? '').trim().slice(0, 160),
    action: input.action,
    entityType: input.entityType ?? 'system',
    entityId: input.entityId
      ? new mongoose.Types.ObjectId(input.entityId)
      : null,
    summary: input.summary.trim().slice(0, 500),
    metadata: input.metadata ?? {},
  });
}

export async function listCompanyActivity(
  employer: AuthenticatedEmployer,
  query: { page: number; limit: number },
) {
  const filter = { companyId: new mongoose.Types.ObjectId(employer.companyId) };
  const skip = (query.page - 1) * query.limit;
  const [total, rows] = await Promise.all([
    CompanyActivityLog.countDocuments(filter),
    CompanyActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit),
  ]);

  return {
    activities: rows.map((row) => ({
      id: row._id.toString(),
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId ? row.entityId.toString() : null,
      summary: row.summary ?? '',
      actorEmployerId: row.actorEmployerId.toString(),
      actorName: row.actorName ?? '',
      metadata: row.metadata ?? {},
      createdAt: row.createdAt ?? null,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}
