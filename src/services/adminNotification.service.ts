import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import { NOTIFICATION_TYPES, type NotificationType } from '../constants/enums';
import { Notification } from '../models/Notification';
import { NotificationTemplate } from '../models/NotificationTemplate';
import { User } from '../models/User';
import type { AuthenticatedAdmin } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { mapNotification } from '../utils/notificationMapper';
import { writeAuditSafely } from './audit.service';
import { createNotification } from './notification.service';
import type {
  AdminNotificationQuery,
  AdminNotificationSendInput,
  NotificationTemplateCreateInput,
  NotificationTemplateQuery,
  NotificationTemplateUpdateInput,
} from '../validators/adminNotification.validator';

const MAX_BROADCAST = 5000;
const BATCH_SIZE = 100;

function mapTemplate(doc: {
  _id: { toString(): string };
  key: string;
  name: string;
  type: string;
  titleTemplate: string;
  messageTemplate: string;
  audience?: string;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: doc._id.toString(),
    key: doc.key,
    name: doc.name,
    type: doc.type,
    titleTemplate: doc.titleTemplate,
    messageTemplate: doc.messageTemplate,
    audience: doc.audience ?? 'all',
    status: doc.status ?? 'active',
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => vars[key] ?? '');
}

async function resolveRecipientIds(input: AdminNotificationSendInput): Promise<string[]> {
  if (input.userIds?.length) {
    const unique = [...new Set(input.userIds)];
    if (unique.length > MAX_BROADCAST) {
      throw new AppError(`Cannot target more than ${MAX_BROADCAST} users`, HTTP_STATUS.BAD_REQUEST);
    }
    const users = await User.find({
      _id: { $in: unique.map((id) => new mongoose.Types.ObjectId(id)) },
      status: 'active',
      role: { $in: ['candidate', 'employer'] },
    }).select('_id');
    return users.map((u) => u._id.toString());
  }

  const filter: Record<string, unknown> = { status: 'active' };
  if (input.audience === 'candidate' || input.audience === 'employer') {
    filter.role = input.audience;
  } else {
    filter.role = { $in: ['candidate', 'employer'] };
  }

  const users = await User.find(filter).select('_id').limit(MAX_BROADCAST).lean();

  return users.map((u) => u._id.toString());
}

export class AdminNotificationService {
  async listHistory(query: AdminNotificationQuery) {
    const filter: Record<string, unknown> = {};
    if (query.type) filter.type = query.type;
    if (query.audience === 'candidate' || query.audience === 'employer') {
      const roleUsers = await User.find({ role: query.audience, status: 'active' })
        .select('_id')
        .limit(20_000)
        .lean();
      filter.recipientId = { $in: roleUsers.map((u) => u._id) };
    }
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) (filter.createdAt as Record<string, Date>).$gte = new Date(query.from);
      if (query.to) (filter.createdAt as Record<string, Date>).$lte = new Date(query.to);
    }
    // Boost-related history (sheet 427)
    if (query.boostOnly) {
      filter.type = { $in: ['HOT_JOB', 'JOB_MATCH', 'JOB_NEARBY', 'JOB_SALARY_MATCH'] };
    }

    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      Notification.countDocuments(filter),
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    ]);

    return {
      notifications: rows.map((row) => ({
        ...mapNotification(row),
        recipientId: row.recipientId?.toString?.() ?? String(row.recipientId ?? ''),
        read: Boolean(row.read),
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async send(admin: AuthenticatedAdmin, input: AdminNotificationSendInput) {
    let title = input.title?.trim() ?? '';
    let message = input.message?.trim() ?? '';
    let type: NotificationType = (input.type as NotificationType) || 'SYSTEM';

    if (input.templateKey) {
      const template = await NotificationTemplate.findOne({
        key: input.templateKey.trim().toLowerCase(),
        status: 'active',
      });
      if (!template) {
        throw new AppError('Notification template not found', HTTP_STATUS.NOT_FOUND);
      }
      const vars: Record<string, string> = { ...(input.variables ?? {}) };
      title = applyTemplate(template.titleTemplate, vars);
      message = applyTemplate(template.messageTemplate, vars);
      type = template.type as NotificationType;
    }

    if (!title || !message) {
      throw new AppError('title and message are required (or provide templateKey)', HTTP_STATUS.BAD_REQUEST);
    }
    if (!(NOTIFICATION_TYPES as readonly string[]).includes(type)) {
      throw new AppError('Invalid notification type', HTTP_STATUS.BAD_REQUEST);
    }

    const recipientIds = await resolveRecipientIds(input);
    if (recipientIds.length === 0) {
      throw new AppError('No matching recipients', HTTP_STATUS.BAD_REQUEST);
    }

    let sent = 0;
    let failed = 0;
    for (let i = 0; i < recipientIds.length; i += BATCH_SIZE) {
      const chunk = recipientIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        chunk.map((recipientId) =>
          createNotification({
            recipientId,
            type,
            title,
            message,
            data: {
              source: 'admin_broadcast',
              audience: input.audience ?? 'all',
              ...(input.data ?? {}),
            },
          }),
        ),
      );
      for (const result of results) {
        if (result.status === 'fulfilled') sent += 1;
        else failed += 1;
      }
    }

    await writeAuditSafely({
      admin,
      action: 'notification_broadcast_sent',
      entityType: 'notification',
      metadata: {
        audience: input.audience ?? 'all',
        type,
        recipientCount: recipientIds.length,
        sent,
        failed,
        templateKey: input.templateKey ?? null,
      },
    });

    return {
      audience: input.audience ?? (input.userIds?.length ? 'targeted' : 'all'),
      requested: recipientIds.length,
      sent,
      failed,
      type,
      title,
    };
  }

  async listTemplates(query: NotificationTemplateQuery) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.audience) filter.audience = query.audience;
    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      NotificationTemplate.countDocuments(filter),
      NotificationTemplate.find(filter).sort({ name: 1 }).skip(skip).limit(query.limit),
    ]);
    return {
      templates: rows.map((row) => mapTemplate(row)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async createTemplate(input: NotificationTemplateCreateInput) {
    try {
      const template = await NotificationTemplate.create({
        ...input,
        key: input.key.trim().toLowerCase(),
      });
      return { template: mapTemplate(template) };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        throw new AppError('Template key already exists', HTTP_STATUS.CONFLICT);
      }
      throw error;
    }
  }

  async updateTemplate(id: string, input: NotificationTemplateUpdateInput) {
    const template = await NotificationTemplate.findById(id);
    if (!template) throw new AppError('Template not found', HTTP_STATUS.NOT_FOUND);
    Object.assign(template, input);
    await template.save();
    return { template: mapTemplate(template) };
  }

  async deleteTemplate(id: string) {
    const template = await NotificationTemplate.findByIdAndDelete(id);
    if (!template) throw new AppError('Template not found', HTTP_STATUS.NOT_FOUND);
    return { deleted: true, id };
  }
}

export const adminNotificationService = new AdminNotificationService();
