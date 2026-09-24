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
    /** Phone dial-in number when type is phone (or optional contact on other types). */
    phoneContact: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '', maxlength: 5000 },
    status: {
      type: String,
      enum: INTERVIEW_STATUSES,
      default: 'scheduled',
    },
    cancellationReason: { type: String, trim: true, default: '' },
    /** Employer feedback after completing the interview (292). */
    feedback: {
      rating: { type: Number, min: 1, max: 5, default: null },
      outcome: {
        type: String,
        enum: ['hire', 'reject', 'hold', 'next_round', ''],
        default: '',
      },
      notes: { type: String, trim: true, default: '', maxlength: 5000 },
      submittedAt: { type: Date, default: null },
    },
    /** Set when 24h reminder notification was sent (idempotent worker). */
    reminder24hSentAt: { type: Date, default: null },
    /** Set when 1h reminder notification was sent (idempotent worker). */
    reminder1hSentAt: { type: Date, default: null },
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
