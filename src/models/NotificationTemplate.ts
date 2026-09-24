import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { ENTITY_STATUSES, NOTIFICATION_TYPES } from '../constants/enums';

/**
 * Reusable in-app notification copy (sheet 429).
 * Admin send can reference a template key; push/email remain out of scope.
 */
const notificationTemplateSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 80,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      default: 'SYSTEM',
    },
    titleTemplate: { type: String, required: true, trim: true, maxlength: 200 },
    messageTemplate: { type: String, required: true, trim: true, maxlength: 2000 },
    audience: {
      type: String,
      enum: ['all', 'candidate', 'employer'],
      default: 'all',
    },
    status: {
      type: String,
      enum: ENTITY_STATUSES,
      default: 'active',
    },
  },
  {
    timestamps: true,
    collection: 'notification_templates',
  },
);

notificationTemplateSchema.index({ key: 1 }, { unique: true });
notificationTemplateSchema.index({ status: 1, audience: 1 });

export type INotificationTemplate = InferSchemaType<typeof notificationTemplateSchema>;
export type NotificationTemplateModel = Model<INotificationTemplate>;

export const NotificationTemplate: NotificationTemplateModel =
  (models.NotificationTemplate as NotificationTemplateModel) ||
  model<INotificationTemplate>('NotificationTemplate', notificationTemplateSchema);
