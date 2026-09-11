import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import { NOTIFICATION_TYPES, type NotificationType } from '../constants/enums';
import { Candidate } from '../models/Candidate';
import { Employer } from '../models/Employer';
import { Notification } from '../models/Notification';
import { AppError } from '../utils/AppError';
import { mapNotification } from '../utils/notificationMapper';
import type { NotificationQuery } from '../validators/notification.validator';

const SENSITIVE_DATA_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'jwt',
  'authorization',
]);

export interface CreateNotificationInput {
  recipientId: string | mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

function assertNotificationType(type: string): asserts type is NotificationType {
  if (!(NOTIFICATION_TYPES as readonly string[]).includes(type)) {
    throw new AppError('Invalid notification type', HTTP_STATUS.BAD_REQUEST);
  }
}

function sanitizeData(data?: Record<string, unknown>): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('$') || SENSITIVE_DATA_KEYS.has(key)) {
      continue;
    }
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      clean[key] = value;
    } else if (value instanceof Date) {
      clean[key] = value.toISOString();
    } else if (
      typeof value === 'object' &&
      value !== null &&
      'toString' in value &&
      mongoose.Types.ObjectId.isValid(String(value))
    ) {
      clean[key] = String(value);
    }
  }
  return clean;
}

/**
 * Internal factory used by domain services.
 * Throws on invalid input — callers that must not fail should use `notifySafely`.
 */
export async function createNotification(input: CreateNotificationInput) {
  assertNotificationType(input.type);

  const title = input.title.trim();
  const message = input.message.trim();
  if (!title || !message) {
    throw new AppError('Notification title and message are required', HTTP_STATUS.BAD_REQUEST);
  }

  const recipientId = new mongoose.Types.ObjectId(String(input.recipientId));
  const notification = await Notification.create({
    recipientId,
    type: input.type,
    title: title.slice(0, 200),
    message: message.slice(0, 2000),
    data: sanitizeData(input.data),
    read: false,
    readAt: undefined,
  });

  return mapNotification(notification);
}

/**
 * Fire-and-forget style wrapper — logs failures without throwing.
 */
export async function notifySafely(input: CreateNotificationInput): Promise<void> {
  try {
    await createNotification(input);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    console.error(`[notifications] failed to create ${input.type}: ${reason}`);
  }
}

export async function resolveCandidateUserId(
  candidateId: string | mongoose.Types.ObjectId,
): Promise<string | null> {
  const candidate = await Candidate.findById(candidateId).select('userId');
  return candidate?.userId ? candidate.userId.toString() : null;
}

export async function resolveEmployerUserId(
  employerId: string | mongoose.Types.ObjectId,
): Promise<string | null> {
  const employer = await Employer.findById(employerId).select('userId');
  return employer?.userId ? employer.userId.toString() : null;
}

export class NotificationService {
  async list(userId: string, query: NotificationQuery) {
    const filter: Record<string, unknown> = {
      recipientId: new mongoose.Types.ObjectId(userId),
    };
    if (query.isRead !== undefined) {
      filter.read = query.isRead;
    }
    if (query.type) {
      filter.type = query.type;
    }

    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      Notification.countDocuments(filter),
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    ]);

    return {
      notifications: rows.map((row) => mapNotification(row)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getById(userId: string, id: string) {
    const notification = await Notification.findOne({
      _id: id,
      recipientId: userId,
    });
    if (!notification) {
      throw new AppError('Notification not found', HTTP_STATUS.NOT_FOUND);
    }
    return { notification: mapNotification(notification) };
  }

  async markRead(userId: string, id: string) {
    const notification = await Notification.findOne({
      _id: id,
      recipientId: userId,
    });
    if (!notification) {
      throw new AppError('Notification not found', HTTP_STATUS.NOT_FOUND);
    }

    if (!notification.read) {
      notification.read = true;
      notification.readAt = new Date();
      await notification.save();
    }

    return { notification: mapNotification(notification) };
  }

  async markUnread(userId: string, id: string) {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        recipientId: userId,
      },
      {
        $set: { read: false },
        $unset: { readAt: 1 },
      },
      { new: true },
    );
    if (!notification) {
      throw new AppError('Notification not found', HTTP_STATUS.NOT_FOUND);
    }

    return { notification: mapNotification(notification) };
  }

  async markAllRead(userId: string) {
    const result = await Notification.updateMany(
      {
        recipientId: new mongoose.Types.ObjectId(userId),
        read: false,
      },
      {
        $set: {
          read: true,
          readAt: new Date(),
        },
      },
    );

    return {
      updatedCount: result.modifiedCount ?? 0,
    };
  }

  async delete(userId: string, id: string) {
    const result = await Notification.findOneAndDelete({
      _id: id,
      recipientId: userId,
    });
    if (!result) {
      throw new AppError('Notification not found', HTTP_STATUS.NOT_FOUND);
    }
    return { deleted: true, id };
  }

  async unreadCount(userId: string) {
    const count = await Notification.countDocuments({
      recipientId: new mongoose.Types.ObjectId(userId),
      read: false,
    });
    return { count };
  }
}

export const notificationService = new NotificationService();
