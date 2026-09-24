import { randomBytes } from 'node:crypto';
import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { EMPLOYER_TEAM_INVITE_STATUSES } from '../constants/enums';

function newInviteToken(): string {
  return randomBytes(24).toString('hex');
}

/**
 * Invite a recruiter to join an existing company (sheet 160–162).
 */
const employerTeamInviteSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    invitedByEmployerId: {
      type: Schema.Types.ObjectId,
      ref: 'Employer',
      required: true,
    },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    name: { type: String, trim: true, default: '', maxlength: 120 },
    teamRole: {
      type: String,
      enum: ['hr', 'recruiter'],
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      default: newInviteToken,
    },
    status: {
      type: String,
      enum: EMPLOYER_TEAM_INVITE_STATUSES,
      default: 'pending',
    },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date },
    acceptedEmployerId: { type: Schema.Types.ObjectId, ref: 'Employer' },
  },
  {
    timestamps: true,
    collection: 'employer_team_invites',
  },
);

employerTeamInviteSchema.index({ companyId: 1, email: 1, status: 1 });
employerTeamInviteSchema.index({ expiresAt: 1 });

export type IEmployerTeamInvite = InferSchemaType<typeof employerTeamInviteSchema>;
export type EmployerTeamInviteModel = Model<IEmployerTeamInvite>;

export const EmployerTeamInvite: EmployerTeamInviteModel =
  (models.EmployerTeamInvite as EmployerTeamInviteModel) ||
  model<IEmployerTeamInvite>('EmployerTeamInvite', employerTeamInviteSchema);
