import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { ALERT_FREQUENCIES, EMPLOYMENT_TYPES, WORK_MODES } from '../constants/enums';

const savedSearchFiltersSchema = new Schema(
  {
    q: { type: String, trim: true, maxlength: 100, default: '' },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location' },
    workMode: { type: String, enum: [...WORK_MODES, ''], default: '' },
    employmentType: { type: String, enum: [...EMPLOYMENT_TYPES, ''], default: '' },
    experienceMin: { type: Number, min: 0, max: 50 },
    experienceMax: { type: Number, min: 0, max: 50 },
    salaryMin: { type: Number, min: 0 },
    salaryMax: { type: Number, min: 0 },
    featured: { type: Boolean },
    urgent: { type: Boolean },
    government: { type: Boolean },
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
    radiusKm: { type: Number, min: 1, max: 500 },
    skills: { type: [String], default: [] },
  },
  { _id: false },
);

const savedSearchSchema = new Schema(
  {
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    filters: {
      type: savedSearchFiltersSchema,
      default: () => ({}),
    },
    frequency: {
      type: String,
      enum: ALERT_FREQUENCIES,
      default: 'daily',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastMatchedAt: { type: Date },
    lastNotifiedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'saved_searches',
  },
);

savedSearchSchema.index({ candidateId: 1, createdAt: -1 });
savedSearchSchema.index({ candidateId: 1, isActive: 1, frequency: 1 });
savedSearchSchema.index({ isActive: 1, frequency: 1, lastNotifiedAt: 1 });

export type ISavedSearch = InferSchemaType<typeof savedSearchSchema>;
export type SavedSearchModel = Model<ISavedSearch>;

export const SavedSearch: SavedSearchModel =
  (models.SavedSearch as SavedSearchModel) ||
  model<ISavedSearch>('SavedSearch', savedSearchSchema);
