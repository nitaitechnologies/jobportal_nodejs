import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { APPLICATION_STATUSES } from '../constants/enums';

const applicationAnswerSchema = new Schema(
  {
    question: { type: String, trim: true, required: true },
    answer: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

/** Employer-private ATS notes (253). */
const internalNoteSchema = new Schema(
  {
    text: { type: String, trim: true, required: true, maxlength: 5000 },
    authorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    authorName: { type: String, trim: true, default: '', maxlength: 120 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
  },
  { _id: true },
);

/** Durable stage history for application timeline (258). */
const statusHistorySchema = new Schema(
  {
    from: { type: String, enum: APPLICATION_STATUSES, required: true },
    to: { type: String, enum: APPLICATION_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    byUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    byName: { type: String, trim: true, default: '', maxlength: 120 },
    auto: { type: Boolean, default: false },
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
    /** Snapshot of profile video resume or per-application override. */
    videoResume: { type: String, trim: true, default: '' },
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
    interviewAt: { type: Date },
    rejectedAt: { type: Date },
    hiredAt: { type: Date },
    /** Employer-private ATS notes (253). */
    notes: { type: String, trim: true, default: '', maxlength: 5000 },
    internalNotes: { type: [internalNoteSchema], default: [] },
    /** Internal recruiter rating 1–5 (sheet 332). */
    internalRating: { type: Number, min: 1, max: 5, default: null },
    statusHistory: { type: [statusHistorySchema], default: [] },
    source: { type: String, trim: true, default: 'platform', maxlength: 80 },
    /** Recruiter assigned to this application (sheet 338). */
    assignedEmployerId: {
      type: Schema.Types.ObjectId,
      ref: 'Employer',
      default: null,
    },
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
applicationSchema.index({ companyId: 1, assignedEmployerId: 1, appliedAt: -1 });

export type IApplication = InferSchemaType<typeof applicationSchema>;
export type ApplicationModel = Model<IApplication>;

export const Application: ApplicationModel =
  (models.Application as ApplicationModel) ||
  model<IApplication>('Application', applicationSchema);
