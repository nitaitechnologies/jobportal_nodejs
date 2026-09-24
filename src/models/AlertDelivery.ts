import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { NOTIFICATION_TYPES } from '../constants/enums';

/**
 * Dedupe log so the same candidate does not get the same job alert repeatedly.
 */
const alertDeliverySchema = new Schema(
  {
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    savedSearchId: {
      type: Schema.Types.ObjectId,
      ref: 'SavedSearch',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'alert_deliveries',
  },
);

alertDeliverySchema.index(
  { candidateId: 1, jobId: 1, type: 1 },
  { unique: true },
);
alertDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 45 });

export type IAlertDelivery = InferSchemaType<typeof alertDeliverySchema>;
export type AlertDeliveryModel = Model<IAlertDelivery>;

export const AlertDelivery: AlertDeliveryModel =
  (models.AlertDelivery as AlertDeliveryModel) ||
  model<IAlertDelivery>('AlertDelivery', alertDeliverySchema);
