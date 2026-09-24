import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

export const RECONTACT_STATUSES = ['scheduled', 'sent', 'cancelled'] as const;

/**
 * Future vacancy re-contact queue (sheet 241).
 * Optional jobId when a role opens; worker sends invite/notification at remindAt.
 */
const recontactReminderSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    employerId: {
      type: Schema.Types.ObjectId,
      ref: 'Employer',
      required: true,
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    remindAt: {
      type: Date,
      required: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
    },
    status: {
      type: String,
      enum: RECONTACT_STATUSES,
      default: 'scheduled',
    },
    sentAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'recontact_reminders',
  },
);

recontactReminderSchema.index({ companyId: 1, status: 1, remindAt: 1 });
recontactReminderSchema.index({ companyId: 1, candidateId: 1, createdAt: -1 });

export type IRecontactReminder = InferSchemaType<typeof recontactReminderSchema>;
export type RecontactReminderModel = Model<IRecontactReminder>;

export const RecontactReminder: RecontactReminderModel =
  (models.RecontactReminder as RecontactReminderModel) ||
  model<IRecontactReminder>('RecontactReminder', recontactReminderSchema);
