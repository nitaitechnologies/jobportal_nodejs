import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

/**
 * Company-scoped recruiter activity feed (sheet 339).
 */
const companyActivitySchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    actorEmployerId: {
      type: Schema.Types.ObjectId,
      ref: 'Employer',
      required: true,
    },
    actorName: { type: String, trim: true, default: '', maxlength: 160 },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    entityType: {
      type: String,
      enum: ['job', 'application', 'team', 'invite', 'system'],
      default: 'system',
    },
    entityId: { type: Schema.Types.ObjectId, default: null },
    summary: { type: String, trim: true, default: '', maxlength: 500 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'company_activity_logs',
  },
);

companyActivitySchema.index({ companyId: 1, createdAt: -1 });

export type ICompanyActivityLog = InferSchemaType<typeof companyActivitySchema>;
export type CompanyActivityLogModel = Model<ICompanyActivityLog>;

export const CompanyActivityLog: CompanyActivityLogModel =
  (models.CompanyActivityLog as CompanyActivityLogModel) ||
  model<ICompanyActivityLog>('CompanyActivityLog', companyActivitySchema);
