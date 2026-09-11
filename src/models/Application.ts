import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { APPLICATION_STATUSES } from '../constants/enums';

const applicationAnswerSchema = new Schema(
  {
    question: { type: String, trim: true, required: true },
    answer: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const applicationSchema = new Schema(
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
    employerId: {
      type: Schema.Types.ObjectId,
      ref: 'Employer',
      required: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    resume: { type: String, trim: true, default: '' },
    coverLetter: { type: String, trim: true, default: '', maxlength: 10000 },
    answers: { type: [applicationAnswerSchema], default: [] },
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: 'applied',
    },
    appliedAt: { type: Date, default: Date.now },
    viewedAt: { type: Date },
    shortlistedAt: { type: Date },
    rejectedAt: { type: Date },
    hiredAt: { type: Date },
    notes: { type: String, trim: true, default: '', maxlength: 5000 },
    source: { type: String, trim: true, default: 'platform', maxlength: 80 },
  },
  {
    timestamps: true,
    collection: 'applications',
  },
);

applicationSchema.index({ candidateId: 1, jobId: 1 }, { unique: true });
applicationSchema.index({ jobId: 1, status: 1, appliedAt: -1 });
applicationSchema.index({ employerId: 1, status: 1, appliedAt: -1 });
applicationSchema.index({ companyId: 1, status: 1 });
applicationSchema.index({ candidateId: 1, status: 1, appliedAt: -1 });

export type IApplication = InferSchemaType<typeof applicationSchema>;
export type ApplicationModel = Model<IApplication>;

export const Application: ApplicationModel =
  (models.Application as ApplicationModel) ||
  model<IApplication>('Application', applicationSchema);
