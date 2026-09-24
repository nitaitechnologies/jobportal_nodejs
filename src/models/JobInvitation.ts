import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { INVITATION_STATUSES } from '../constants/enums';

const jobInvitationSchema = new Schema(
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
    message: { type: String, trim: true, default: '', maxlength: 2000 },
    status: {
      type: String,
      enum: INVITATION_STATUSES,
      default: 'pending',
    },
    expiresAt: { type: Date },
    respondedAt: { type: Date },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
    },
  },
  {
    timestamps: true,
    collection: 'job_invitations',
  },
);

jobInvitationSchema.index({ candidateId: 1, status: 1, createdAt: -1 });
jobInvitationSchema.index({ employerId: 1, status: 1, createdAt: -1 });
jobInvitationSchema.index({ jobId: 1, status: 1 });
jobInvitationSchema.index(
  { candidateId: 1, jobId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
  },
);

export type IJobInvitation = InferSchemaType<typeof jobInvitationSchema>;
export type JobInvitationModel = Model<IJobInvitation>;

export const JobInvitation: JobInvitationModel =
  (models.JobInvitation as JobInvitationModel) ||
  model<IJobInvitation>('JobInvitation', jobInvitationSchema);
