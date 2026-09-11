import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { REPORT_REASONS, REPORT_STATUSES, REPORT_TARGET_TYPES } from '../constants/enums';

const reportSchema = new Schema(
  {
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetType: {
      type: String,
      enum: REPORT_TARGET_TYPES,
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    reason: {
      type: String,
      enum: REPORT_REASONS,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 5000,
    },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: 'pending',
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: { type: Date },
    resolution: { type: String, trim: true, default: '', maxlength: 5000 },
  },
  {
    timestamps: true,
    collection: 'reports',
  },
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, targetId: 1 });
reportSchema.index({ reporterId: 1, createdAt: -1 });
reportSchema.index({ reviewedBy: 1 });
reportSchema.index(
  { reporterId: 1, targetType: 1, targetId: 1 },
  {
    unique: true,
    name: 'unique_active_report_per_target',
    partialFilterExpression: {
      status: { $in: ['pending', 'reviewing'] },
    },
  },
);

export type IReport = InferSchemaType<typeof reportSchema>;
export type ReportModel = Model<IReport>;

export const Report: ReportModel =
  (models.Report as ReportModel) || model<IReport>('Report', reportSchema);
