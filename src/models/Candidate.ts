import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import {
  CANDIDATE_JOB_TYPES,
  EMPLOYMENT_STATUSES,
  GENDERS,
  PROFILE_VISIBILITY,
  SHIFT_PREFERENCES,
  WORK_MODES,
  WORKING_DAY_PREFERENCES,
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
    /** Same place catalog as job offices, so distance uses matching coordinates. */
    placeId: { type: String, trim: true, default: '' },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    preferredLocations: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    preferredRoles: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    preferredCategories: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    preferredJobTypes: {
      type: [{ type: String, enum: CANDIDATE_JOB_TYPES }],
      default: [],
    },
    preferredWorkModes: {
      type: [{ type: String, enum: WORK_MODES }],
      default: [],
    },
    preferredWorkingDays: {
      type: [{ type: String, enum: WORKING_DAY_PREFERENCES }],
      default: [],
    },
    preferredShifts: {
      type: [{ type: String, enum: SHIFT_PREFERENCES }],
      default: [],
    },
    currentJobTitle: { type: String, trim: true, default: '' },
    currentCompany: { type: String, trim: true, default: '' },
    totalExperience: { type: Number, min: 0, default: 0 },
    currentSalary: { type: Number, min: 0 },
    expectedSalary: { type: Number, min: 0 },
    noticePeriod: { type: Number, min: 0, default: 0 },
    /** Calendar date the candidate can join. Kept in sync with noticePeriod. */
    availableFrom: { type: Date },
    /** Hire Me / Available for Work flag. */
    openToWork: { type: Boolean, default: true },
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
    /** Trust badge lifecycle (sheet 147–148). */
    verificationStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'rejected'],
      default: 'unverified',
    },
    documents: {
      type: [
        {
          type: {
            type: String,
            enum: ['aadhaar', 'pan', 'passport', 'other'],
            required: true,
          },
          mediaUrl: { type: String, trim: true, required: true, maxlength: 500 },
          status: {
            type: String,
            enum: ['pending', 'verified', 'rejected'],
            default: 'pending',
          },
          submittedAt: { type: Date, default: Date.now },
          reviewedAt: { type: Date, default: null },
          rejectionReason: { type: String, trim: true, default: '', maxlength: 500 },
        },
      ],
      default: [],
    },
    /** Soft acquisition channel for admin source metrics (sheet 441). Default direct. */
    acquisitionSource: {
      type: String,
      trim: true,
      maxlength: 40,
      default: 'direct',
    },
    profileVisibility: {
      type: String,
      enum: PROFILE_VISIBILITY,
      default: 'public',
    },
    /** When false, employers cannot unlock phone/email (sheet 369). */
    allowEmployerContact: { type: Boolean, default: true },
    /** When false, employers cannot download/view resume file. */
    resumeVisibleToEmployers: { type: Boolean, default: true },
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
