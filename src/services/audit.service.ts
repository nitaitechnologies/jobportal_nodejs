import mongoose from 'mongoose';
import { AdminAuditLog } from '../models/AdminAuditLog';
import type { AuthenticatedAdmin } from '../types/auth.types';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'jwt',
  'authorization',
]);

export interface WriteAuditInput {
  admin: AuthenticatedAdmin;
  action: string;
  entityType: string;
  entityId?: string | mongoose.Types.ObjectId | null;
  metadata?: Record<string, unknown>;
}

function sanitizeMetadata(data?: Record<string, unknown>): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('$') || SENSITIVE_KEYS.has(key)) continue;
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      clean[key] = typeof value === 'string' ? value.slice(0, 500) : value;
    } else if (value instanceof Date) {
      clean[key] = value.toISOString();
    } else if (mongoose.Types.ObjectId.isValid(String(value))) {
      clean[key] = String(value);
    }
  }
  return clean;
}

export async function writeAuditLog(input: WriteAuditInput) {
  return AdminAuditLog.create({
    adminUserId: new mongoose.Types.ObjectId(input.admin.adminUserId),
    actorUserId: new mongoose.Types.ObjectId(input.admin.userId),
    action: input.action.slice(0, 120),
    entityType: input.entityType.slice(0, 80),
    entityId: input.entityId
      ? new mongoose.Types.ObjectId(String(input.entityId))
      : undefined,
    metadata: sanitizeMetadata(input.metadata),
  });
}

export async function writeAuditSafely(input: WriteAuditInput): Promise<void> {
  try {
    await writeAuditLog(input);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    console.error(`[audit] failed to write ${input.action}: ${reason}`);
  }
}

export function mapAuditLog(doc: {
  _id: mongoose.Types.ObjectId;
  adminUserId: mongoose.Types.ObjectId;
  actorUserId: mongoose.Types.ObjectId;
  action: string;
  entityType: string;
  entityId?: mongoose.Types.ObjectId | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: Date;
}) {
  return {
    id: doc._id.toString(),
    adminUserId: doc.adminUserId.toString(),
    actorUserId: doc.actorUserId.toString(),
    action: doc.action,
    entityType: doc.entityType,
    entityId: doc.entityId ? doc.entityId.toString() : null,
    metadata: sanitizeMetadata(doc.metadata ?? undefined),
    createdAt: doc.createdAt ?? null,
  };
}
