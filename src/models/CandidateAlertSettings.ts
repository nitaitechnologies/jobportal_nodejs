import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { ALERT_FREQUENCIES } from '../constants/enums';

/**
 * Per-candidate global job-alert preferences (073–082 companion to SavedSearch).
 */
const candidateAlertSettingsSchema = new Schema(
  {
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true,
      unique: true,
    },
    /** New jobs matching profile skills/prefs. */
    matchingJobs: { type: Boolean, default: true },
    matchScoreMin: { type: Number, min: 0, max: 100, default: 60 },
    nearbyJobs: { type: Boolean, default: true },
    nearbyRadiusKm: { type: Number, min: 1, max: 500, default: 25 },
    salaryAlerts: { type: Boolean, default: true },
    hotJobs: { type: Boolean, default: true },
    deadlineAlerts: { type: Boolean, default: true },
    /** Days before deadline/expiry to remind savers. */
    deadlineDays: { type: Number, min: 1, max: 30, default: 3 },
    governmentJobs: { type: Boolean, default: true },
    /** Preference-based digest when not using a saved search. */
    digestFrequency: {
      type: String,
      enum: ALERT_FREQUENCIES,
      default: 'daily',
    },
    lastDigestAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'candidate_alert_settings',
  },
);

candidateAlertSettingsSchema.index({ matchingJobs: 1 });
candidateAlertSettingsSchema.index({ nearbyJobs: 1 });
candidateAlertSettingsSchema.index({ hotJobs: 1 });
candidateAlertSettingsSchema.index({ governmentJobs: 1 });
candidateAlertSettingsSchema.index({ digestFrequency: 1, lastDigestAt: 1 });

export type ICandidateAlertSettings = InferSchemaType<typeof candidateAlertSettingsSchema>;
export type CandidateAlertSettingsModel = Model<ICandidateAlertSettings>;

export const CandidateAlertSettings: CandidateAlertSettingsModel =
  (models.CandidateAlertSettings as CandidateAlertSettingsModel) ||
  model<ICandidateAlertSettings>('CandidateAlertSettings', candidateAlertSettingsSchema);
