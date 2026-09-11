import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { NOTIFICATION_TYPES } from '../constants/enums';

const notificationSchema = new Schema(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      enum: NOTIFICATION_TYPES,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'notifications',
  },
);

notificationSchema.index({ recipientId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });

export type INotification = InferSchemaType<typeof notificationSchema>;
export type NotificationModel = Model<INotification>;

export const Notification: NotificationModel =
  (models.Notification as NotificationModel) ||
  model<INotification>('Notification', notificationSchema);
