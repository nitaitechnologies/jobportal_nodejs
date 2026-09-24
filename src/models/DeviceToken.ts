import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

/**
 * Device tokens for central push delivery (sheet 472).
 * One user may have multiple devices (android / ios / web).
 */
const deviceTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, trim: true, maxlength: 512 },
    platform: {
      type: String,
      enum: ['android', 'ios', 'web'],
      default: 'android',
    },
    app: {
      type: String,
      enum: ['candidate', 'employer', 'admin'],
      default: 'candidate',
    },
    lastSeenAt: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: 'device_tokens',
  },
);

deviceTokenSchema.index({ token: 1 }, { unique: true });
deviceTokenSchema.index({ userId: 1, active: 1 });

export type IDeviceToken = InferSchemaType<typeof deviceTokenSchema>;
export type DeviceTokenModel = Model<IDeviceToken>;

export const DeviceToken: DeviceTokenModel =
  (models.DeviceToken as DeviceTokenModel) ||
  model<IDeviceToken>('DeviceToken', deviceTokenSchema);
