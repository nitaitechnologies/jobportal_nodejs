import type { Types } from 'mongoose';

export interface NotificationLike {
  _id: Types.ObjectId | { toString(): string };
  recipientId: Types.ObjectId | { toString(): string };
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
  read?: boolean | null;
  readAt?: Date | null;
  createdAt?: Date;
}

/** Public notification DTO — maps DB `read` → API `isRead`. */
export function mapNotification(notification: NotificationLike) {
  return {
    id: notification._id.toString(),
    type: notification.type,
    title: notification.title,
    message: notification.message,
    data: (notification.data ?? {}) as Record<string, unknown>,
    isRead: Boolean(notification.read),
    readAt: notification.readAt ?? null,
    createdAt: notification.createdAt ?? null,
  };
}
