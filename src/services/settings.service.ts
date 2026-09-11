import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import type { SettingValueType } from '../constants/enums';
import {
  DEFAULT_PLATFORM_SETTINGS,
  PROTECTED_SETTING_PREFIXES,
  SETTING_GROUPS,
  type SettingGroup,
} from '../constants/platformSettings';
import { PlatformSetting } from '../models/PlatformSetting';
import type { AuthenticatedAdmin } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { castStoredValue, coerceSettingValue, normalizeSettingKey } from '../utils/settingValue';
import { writeAuditSafely } from './audit.service';
import type {
  AdminSettingCreateInput,
  AdminSettingListQuery,
  AdminSettingStatusInput,
  AdminSettingUpdateInput,
} from '../validators/settings.validator';

type CacheEntry = { value: unknown; expiresAt: number };

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();
let publicCache: { data: Record<string, unknown>; expiresAt: number } | null = null;

function invalidateCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
  publicCache = null;
}

export function isProtectedSettingKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return PROTECTED_SETTING_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function mapSetting(doc: {
  _id: mongoose.Types.ObjectId;
  key: string;
  value: unknown;
  type: string;
  group: string;
  description?: string | null;
  isPublic?: boolean | null;
  isActive?: boolean | null;
  isEditable?: boolean | null;
  updatedBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const type = doc.type as SettingValueType;
  return {
    id: doc._id.toString(),
    key: doc.key,
    value: castStoredValue(type, doc.value),
    type,
    group: doc.group,
    description: doc.description ?? '',
    isPublic: Boolean(doc.isPublic),
    isActive: doc.isActive !== false,
    isEditable: doc.isEditable !== false,
    isProtected: isProtectedSettingKey(doc.key),
    updatedBy: doc.updatedBy ? doc.updatedBy.toString() : null,
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}

function defaultFor(key: string) {
  return DEFAULT_PLATFORM_SETTINGS.find((s) => s.key === key);
}

/**
 * Insert missing default settings. Idempotent — never overwrites existing values.
 */
export async function ensureDefaultSettings(): Promise<{ created: number }> {
  let created = 0;
  for (const def of DEFAULT_PLATFORM_SETTINGS) {
    const existing = await PlatformSetting.findOne({ key: def.key }).select('_id');
    if (existing) continue;
    await PlatformSetting.create({
      key: def.key,
      value: def.value,
      type: def.type,
      group: def.group,
      description: def.description,
      isPublic: def.isPublic,
      isActive: def.isActive,
      isEditable: def.isEditable,
    });
    created += 1;
  }
  if (created > 0) invalidateCache();
  return { created };
}

export class SettingsService {
  async getSetting<T = unknown>(key: string, fallback?: T): Promise<T> {
    const normalized = normalizeSettingKey(key);
    const cached = cache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    const doc = await PlatformSetting.findOne({ key: normalized, isActive: true });
    if (doc) {
      const value = castStoredValue(doc.type as SettingValueType, doc.value);
      cache.set(normalized, { value, expiresAt: Date.now() + CACHE_TTL_MS });
      return value as T;
    }

    const def = defaultFor(normalized);
    if (def) {
      cache.set(normalized, { value: def.value, expiresAt: Date.now() + CACHE_TTL_MS });
      return def.value as T;
    }

    if (fallback !== undefined) return fallback;
    throw new AppError(`Setting not found: ${normalized}`, HTTP_STATUS.NOT_FOUND);
  }

  async getNumber(key: string, fallback: number): Promise<number> {
    const value = await this.getSetting<unknown>(key, fallback);
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return fallback;
  }

  async getBoolean(key: string, fallback: boolean): Promise<boolean> {
    const value = await this.getSetting<unknown>(key, fallback);
    if (typeof value === 'boolean') return value;
    return fallback;
  }

  async getString(key: string, fallback: string): Promise<string> {
    const value = await this.getSetting<unknown>(key, fallback);
    if (typeof value === 'string') return value;
    return fallback;
  }

  async getPublicSettings(): Promise<Record<string, unknown>> {
    if (publicCache && publicCache.expiresAt > Date.now()) {
      return publicCache.data;
    }

    const data: Record<string, unknown> = {};
    const publicDefaults = DEFAULT_PLATFORM_SETTINGS.filter((d) => d.isPublic);
    const defaultKeys = publicDefaults.map((d) => d.key);

    const knownDocs = await PlatformSetting.find({ key: { $in: defaultKeys } }).select(
      'key value type isPublic isActive',
    );
    const byKey = new Map(knownDocs.map((d) => [d.key, d]));

    for (const def of publicDefaults) {
      const doc = byKey.get(def.key);
      if (!doc) {
        if (def.isActive) data[def.key] = def.value;
        continue;
      }
      // Explicit DB row wins for visibility: inactive or non-public → omit
      if (doc.isPublic && doc.isActive !== false) {
        data[doc.key] = castStoredValue(doc.type as SettingValueType, doc.value);
      }
    }

    const extras = await PlatformSetting.find({
      isPublic: true,
      isActive: true,
      key: { $nin: defaultKeys },
    }).select('key value type');

    for (const row of extras) {
      if (isProtectedSettingKey(row.key)) continue;
      data[row.key] = castStoredValue(row.type as SettingValueType, row.value);
    }

    publicCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    return data;
  }

  async listAdmin(query: AdminSettingListQuery) {
    const filter: Record<string, unknown> = {};
    if (query.group) filter.group = query.group;
    if (query.type) filter.type = query.type;
    if (query.isPublic !== undefined) filter.isPublic = query.isPublic;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.isEditable !== undefined) filter.isEditable = query.isEditable;
    if (query.search) {
      const q = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { key: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const sort: Record<string, 1 | -1> = {
      [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1,
    };

    const [total, rows] = await Promise.all([
      PlatformSetting.countDocuments(filter),
      PlatformSetting.find(filter).sort(sort).skip(skip).limit(query.limit),
    ]);

    return {
      settings: rows.map((row) => mapSetting(row)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getAdminByKey(key: string) {
    const normalized = normalizeSettingKey(key);
    const doc = await PlatformSetting.findOne({ key: normalized });
    if (!doc) {
      const def = defaultFor(normalized);
      if (!def) throw new AppError('Setting not found', HTTP_STATUS.NOT_FOUND);
      return {
        setting: {
          id: null,
          key: def.key,
          value: def.value,
          type: def.type,
          group: def.group,
          description: def.description,
          isPublic: def.isPublic,
          isActive: def.isActive,
          isEditable: def.isEditable,
          isProtected: isProtectedSettingKey(def.key),
          updatedBy: null,
          createdAt: null,
          updatedAt: null,
          source: 'default',
        },
      };
    }
    return { setting: { ...mapSetting(doc), source: 'database' } };
  }

  async create(admin: AuthenticatedAdmin, input: AdminSettingCreateInput) {
    const key = normalizeSettingKey(input.key);
    if (isProtectedSettingKey(key)) {
      throw new AppError(
        'Cannot create settings under a protected namespace',
        HTTP_STATUS.FORBIDDEN,
        [{ path: 'key', message: 'Protected namespace' }],
      );
    }
    if (!(SETTING_GROUPS as readonly string[]).includes(input.group)) {
      throw new AppError('Invalid setting group', HTTP_STATUS.BAD_REQUEST);
    }

    const type = input.type as SettingValueType;
    const value = coerceSettingValue(type, input.value);

    try {
      const doc = await PlatformSetting.create({
        key,
        value,
        type,
        group: input.group as SettingGroup,
        description: input.description ?? '',
        isPublic: Boolean(input.isPublic),
        isActive: input.isActive !== false,
        isEditable: input.isEditable !== false,
        updatedBy: new mongoose.Types.ObjectId(admin.userId),
      });

      invalidateCache(key);
      await writeAuditSafely({
        admin,
        action: 'setting_created',
        entityType: 'platform_setting',
        entityId: doc._id,
        metadata: { key, type, group: input.group },
      });

      return { setting: mapSetting(doc) };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        throw new AppError('Setting key already exists', HTTP_STATUS.CONFLICT);
      }
      throw error;
    }
  }

  async update(admin: AuthenticatedAdmin, key: string, input: AdminSettingUpdateInput) {
    const normalized = normalizeSettingKey(key);
    if (isProtectedSettingKey(normalized)) {
      throw new AppError('Protected settings cannot be modified', HTTP_STATUS.FORBIDDEN);
    }

    const doc = await PlatformSetting.findOne({ key: normalized });
    if (!doc) throw new AppError('Setting not found', HTTP_STATUS.NOT_FOUND);
    if (doc.isEditable === false) {
      throw new AppError('This setting is not editable', HTTP_STATUS.FORBIDDEN);
    }

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    if (input.value !== undefined) {
      before.value = doc.value;
      doc.value = coerceSettingValue(doc.type as SettingValueType, input.value);
      after.value = doc.value;
    }
    if (input.description !== undefined) {
      before.description = doc.description;
      doc.description = input.description;
      after.description = doc.description;
    }
    if (input.isPublic !== undefined) {
      before.isPublic = doc.isPublic;
      doc.isPublic = input.isPublic;
      after.isPublic = doc.isPublic;
    }
    if (input.group !== undefined) {
      if (!(SETTING_GROUPS as readonly string[]).includes(input.group)) {
        throw new AppError('Invalid setting group', HTTP_STATUS.BAD_REQUEST);
      }
      before.group = doc.group;
      doc.group = input.group;
      after.group = doc.group;
    }

    doc.updatedBy = new mongoose.Types.ObjectId(admin.userId);
    await doc.save();
    invalidateCache(normalized);

    await writeAuditSafely({
      admin,
      action: 'setting_updated',
      entityType: 'platform_setting',
      entityId: doc._id,
      metadata: {
        key: normalized,
        changed: Object.keys(after),
        // Avoid logging huge JSON; keep compact scalars
        before: summarizeAuditValues(before),
        after: summarizeAuditValues(after),
      },
    });

    return { setting: mapSetting(doc) };
  }

  async updateStatus(
    admin: AuthenticatedAdmin,
    key: string,
    input: AdminSettingStatusInput,
  ) {
    const normalized = normalizeSettingKey(key);
    if (isProtectedSettingKey(normalized)) {
      throw new AppError('Protected settings cannot be modified', HTTP_STATUS.FORBIDDEN);
    }

    const doc = await PlatformSetting.findOne({ key: normalized });
    if (!doc) throw new AppError('Setting not found', HTTP_STATUS.NOT_FOUND);
    if (doc.isEditable === false) {
      throw new AppError('This setting is not editable', HTTP_STATUS.FORBIDDEN);
    }

    const previous = doc.isActive !== false;
    doc.isActive = input.isActive;
    doc.updatedBy = new mongoose.Types.ObjectId(admin.userId);
    await doc.save();
    invalidateCache(normalized);

    await writeAuditSafely({
      admin,
      action: input.isActive ? 'setting_activated' : 'setting_deactivated',
      entityType: 'platform_setting',
      entityId: doc._id,
      metadata: { key: normalized, from: previous, to: input.isActive },
    });

    return { setting: mapSetting(doc) };
  }

  /** Clamp a page size using jobs public settings (validators keep absolute max 100). */
  async clampPublicJobPageSize(requested: number): Promise<number> {
    const max = await this.getNumber('jobs.public.maxPageSize', 100);
    const safeMax = Math.min(100, Math.max(1, max));
    return Math.min(Math.max(1, requested), safeMax);
  }

  async getPublicJobDefaultPageSize(): Promise<number> {
    const value = await this.getNumber('jobs.public.defaultPageSize', 20);
    return Math.min(100, Math.max(1, value));
  }
}

function summarizeAuditValues(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === 'string') out[k] = v.slice(0, 200);
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null) out[k] = v;
    else out[k] = '[complex]';
  }
  return out;
}

export const settingsService = new SettingsService();
