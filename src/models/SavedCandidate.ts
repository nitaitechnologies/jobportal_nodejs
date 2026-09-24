import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

/**
 * Employer talent-pool membership (save/shortlist from candidate database).
 * Distinct from application `shortlisted` status.
 */
const savedCandidateSchema = new Schema(
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
    folderId: {
      type: Schema.Types.ObjectId,
      ref: 'TalentPoolFolder',
    },
    tags: {
      type: [{ type: String, trim: true, maxlength: 40 }],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'saved_candidates',
  },
);

savedCandidateSchema.index({ companyId: 1, candidateId: 1 }, { unique: true });
savedCandidateSchema.index({ companyId: 1, folderId: 1, createdAt: -1 });
savedCandidateSchema.index({ companyId: 1, tags: 1 });
savedCandidateSchema.index({ companyId: 1, createdAt: -1 });

export type ISavedCandidate = InferSchemaType<typeof savedCandidateSchema>;
export type SavedCandidateModel = Model<ISavedCandidate>;

export const SavedCandidate: SavedCandidateModel =
  (models.SavedCandidate as SavedCandidateModel) ||
  model<ISavedCandidate>('SavedCandidate', savedCandidateSchema);
