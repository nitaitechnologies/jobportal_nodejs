import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import {
  EMPLOYMENT_STATUSES,
  GENDERS,
  PROFILE_VISIBILITY,
} from '../constants/enums';
import {
  certificationSchema,
  educationSchema,
  languageSchema,
  socialLinksSchema,
  workExperienceSchema,
} from './shared/subschemas';

const candidateSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    headline: { type: String, trim: true, default: '', maxlength: 200 },
    bio: { type: String, trim: true, default: '', maxlength: 5000 },
    profilePhoto: { type: String, trim: true, default: '' },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: GENDERS },
    currentLocation: { type: String, trim: true, default: '' },
    preferredLocations: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    currentJobTitle: { type: String, trim: true, default: '' },
    currentCompany: { type: String, trim: true, default: '' },
    totalExperience: { type: Number, min: 0, default: 0 },
    expectedSalary: { type: Number, min: 0 },
    noticePeriod: { type: Number, min: 0, default: 0 },
    employmentStatus: {
      type: String,
      enum: EMPLOYMENT_STATUSES,
      default: 'looking',
    },
    education: { type: [educationSchema], default: [] },
    skills: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    languages: { type: [languageSchema], default: [] },
    workExperience: { type: [workExperienceSchema], default: [] },
    certifications: { type: [certificationSchema], default: [] },
    resume: { type: String, trim: true, default: '' },
    /** Private media: ref for profile video resume (max 2MB / 40s when enabled). */
    videoResume: { type: String, trim: true, default: '' },
    portfolio: { type: String, trim: true, default: '' },
    socialLinks: { type: socialLinksSchema, default: () => ({}) },
    profileVisibility: {
      type: String,
      enum: PROFILE_VISIBILITY,
      default: 'public',
    },
    profileCompletion: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'candidates',
  },
);

candidateSchema.index({ userId: 1 }, { unique: true });
candidateSchema.index({ skills: 1 });
candidateSchema.index({ currentLocation: 1 });
candidateSchema.index({ totalExperience: 1 });
candidateSchema.index({ employmentStatus: 1 });

export type ICandidate = InferSchemaType<typeof candidateSchema>;
export type CandidateModel = Model<ICandidate>;

export const Candidate: CandidateModel =
  (models.Candidate as CandidateModel) || model<ICandidate>('Candidate', candidateSchema);
