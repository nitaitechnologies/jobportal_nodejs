import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { INTERVIEW_STATUSES, INTERVIEW_TYPES } from '../constants/enums';

const interviewSchema = new Schema(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'Candidate',
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
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    type: {
      type: String,
      enum: INTERVIEW_TYPES,
      required: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number,
      min: 5,
      default: 30,
    },
    location: { type: String, trim: true, default: '' },
    meetingLink: { type: String, trim: true, default: '' },
    interviewer: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '', maxlength: 5000 },
    status: {
      type: String,
      enum: INTERVIEW_STATUSES,
      default: 'scheduled',
    },
    cancellationReason: { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
    collection: 'interviews',
  },
);

interviewSchema.index({ applicationId: 1, status: 1 });
interviewSchema.index({ candidateId: 1, status: 1, scheduledAt: 1 });
interviewSchema.index({ employerId: 1, status: 1, scheduledAt: 1 });
interviewSchema.index({ companyId: 1, status: 1 });
interviewSchema.index({ jobId: 1, status: 1, scheduledAt: 1 });
interviewSchema.index({ status: 1, scheduledAt: 1 });
interviewSchema.index({ createdAt: -1 });

export type IInterview = InferSchemaType<typeof interviewSchema>;
export type InterviewModel = Model<IInterview>;

export const Interview: InterviewModel =
  (models.Interview as InterviewModel) || model<IInterview>('Interview', interviewSchema);
