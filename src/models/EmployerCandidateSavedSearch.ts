import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { CANDIDATE_JOB_TYPES, WORK_MODES } from '../constants/enums';

const employerCandidateSearchFiltersSchema = new Schema(
  {
    q: { type: String, trim: true, maxlength: 80, default: '' },
    skill: { type: String, trim: true, maxlength: 80, default: '' },
    skills: { type: [String], default: [] },
    location: { type: String, trim: true, maxlength: 120, default: '' },
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
    radiusKm: { type: Number, min: 1, max: 500 },
    experienceMin: { type: Number, min: 0, max: 60 },
    experienceMax: { type: Number, min: 0, max: 60 },
    education: { type: String, trim: true, maxlength: 120, default: '' },
    expectedSalaryMin: { type: Number, min: 0 },
    expectedSalaryMax: { type: Number, min: 0 },
    jobType: { type: String, enum: [...CANDIDATE_JOB_TYPES, ''], default: '' },
    workMode: { type: String, enum: [...WORK_MODES, ''], default: '' },
    availableBy: { type: String, trim: true, default: '' },
    noticePeriodMax: { type: Number, min: 0, max: 365 },
    language: { type: String, trim: true, maxlength: 60, default: '' },
    isFresher: { type: Boolean },
    openToWork: { type: Boolean },
    jobId: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const employerCandidateSavedSearchSchema = new Schema(
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
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    filters: {
      type: employerCandidateSearchFiltersSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    collection: 'employer_candidate_saved_searches',
  },
);

employerCandidateSavedSearchSchema.index({ companyId: 1, employerId: 1, createdAt: -1 });

export type IEmployerCandidateSavedSearch = InferSchemaType<
  typeof employerCandidateSavedSearchSchema
>;
export type EmployerCandidateSavedSearchModel = Model<IEmployerCandidateSavedSearch>;

export const EmployerCandidateSavedSearch: EmployerCandidateSavedSearchModel =
  (models.EmployerCandidateSavedSearch as EmployerCandidateSavedSearchModel) ||
  model<IEmployerCandidateSavedSearch>(
    'EmployerCandidateSavedSearch',
    employerCandidateSavedSearchSchema,
  );
