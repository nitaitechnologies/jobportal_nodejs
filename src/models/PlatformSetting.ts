import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { SETTING_VALUE_TYPES } from '../constants/enums';

/**
 * Platform configuration (B3 + B24).
 * Secrets (JWT, DB URIs, storage credentials) stay in environment variables.
 */
const platformSettingSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    type: {
      type: String,
      enum: SETTING_VALUE_TYPES,
      default: 'string',
    },
    group: {
      type: String,
      trim: true,
      default: 'general',
      maxlength: 80,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEditable: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    collection: 'platform_settings',
  },
);

platformSettingSchema.index({ key: 1 }, { unique: true });
platformSettingSchema.index({ group: 1, isActive: 1 });
platformSettingSchema.index({ isPublic: 1, isActive: 1 });
platformSettingSchema.index({ isActive: 1 });

export type IPlatformSetting = InferSchemaType<typeof platformSettingSchema>;
export type PlatformSettingModel = Model<IPlatformSetting>;

export const PlatformSetting: PlatformSettingModel =
  (models.PlatformSetting as PlatformSettingModel) ||
  model<IPlatformSetting>('PlatformSetting', platformSettingSchema);
