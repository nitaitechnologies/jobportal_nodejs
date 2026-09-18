import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import {
  MEDIA_CATEGORIES,
  MEDIA_STATUSES,
  MEDIA_VISIBILITY,
} from '../constants/media';

/**
 * Structured media metadata (B23).
 * Binary content lives in the storage provider — never in MongoDB.
 */
const mediaFileSchema = new Schema(
  {
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ownerType: {
      type: String,
      enum: ['candidate', 'employer', 'admin', 'system'],
      required: true,
    },
    entityType: {
      type: String,
      enum: ['candidate', 'user', 'company', 'article', 'job', 'application'],
      required: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    category: {
      type: String,
      enum: MEDIA_CATEGORIES,
      required: true,
    },
    visibility: {
      type: String,
      enum: MEDIA_VISIBILITY,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    storedName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    extension: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    storageProvider: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
      default: 'local',
    },
    storageKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: MEDIA_STATUSES,
      default: 'active',
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'media_files',
  },
);

mediaFileSchema.index({ ownerUserId: 1, category: 1, status: 1 });
mediaFileSchema.index({ entityType: 1, entityId: 1, category: 1, status: 1 });
mediaFileSchema.index({ storageKey: 1 }, { unique: true });
mediaFileSchema.index({ status: 1, createdAt: -1 });

export type IMediaFile = InferSchemaType<typeof mediaFileSchema>;
export type MediaFileModel = Model<IMediaFile>;

export const MediaFile: MediaFileModel =
  (models.MediaFile as MediaFileModel) || model<IMediaFile>('MediaFile', mediaFileSchema);
