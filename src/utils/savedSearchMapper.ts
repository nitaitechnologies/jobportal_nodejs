import type { Types } from 'mongoose';
import type { AlertFrequency } from '../constants/enums';

export interface SavedSearchLike {
  _id: Types.ObjectId | { toString(): string };
  candidateId: Types.ObjectId | { toString(): string };
  name?: string;
  filters?: Record<string, unknown> | null;
  frequency?: string;
  isActive?: boolean;
  lastMatchedAt?: Date | null;
  lastNotifiedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AlertSettingsLike {
  _id?: Types.ObjectId | { toString(): string };
  candidateId: Types.ObjectId | { toString(): string };
  matchingJobs?: boolean;
  matchScoreMin?: number;
  nearbyJobs?: boolean;
  nearbyRadiusKm?: number;
  salaryAlerts?: boolean;
  hotJobs?: boolean;
  deadlineAlerts?: boolean;
  deadlineDays?: number;
  governmentJobs?: boolean;
  digestFrequency?: AlertFrequency | string;
  lastDigestAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export function mapSavedSearch(doc: SavedSearchLike) {
  const filters = { ...(doc.filters ?? {}) } as Record<string, unknown>;
  if (filters.categoryId && typeof filters.categoryId === 'object') {
    filters.categoryId = String(filters.categoryId);
  }
  if (filters.locationId && typeof filters.locationId === 'object') {
    filters.locationId = String(filters.locationId);
  }
  return {
    id: doc._id.toString(),
    name: doc.name ?? '',
    filters,
    frequency: doc.frequency ?? 'daily',
    isActive: doc.isActive !== false,
    lastMatchedAt: doc.lastMatchedAt ?? null,
    lastNotifiedAt: doc.lastNotifiedAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function mapAlertSettings(doc: AlertSettingsLike) {
  return {
    candidateId: doc.candidateId.toString(),
    matchingJobs: doc.matchingJobs !== false,
    matchScoreMin: doc.matchScoreMin ?? 60,
    nearbyJobs: doc.nearbyJobs !== false,
    nearbyRadiusKm: doc.nearbyRadiusKm ?? 25,
    salaryAlerts: doc.salaryAlerts !== false,
    hotJobs: doc.hotJobs !== false,
    deadlineAlerts: doc.deadlineAlerts !== false,
    deadlineDays: doc.deadlineDays ?? 3,
    governmentJobs: doc.governmentJobs !== false,
    digestFrequency: (doc.digestFrequency as AlertFrequency) ?? 'daily',
    lastDigestAt: doc.lastDigestAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}
