import { Schema } from 'mongoose';

/** Reusable social profile links. */
export const socialLinksSchema = new Schema(
  {
    linkedin: { type: String, trim: true, default: '' },
    twitter: { type: String, trim: true, default: '' },
    facebook: { type: String, trim: true, default: '' },
    instagram: { type: String, trim: true, default: '' },
    github: { type: String, trim: true, default: '' },
    website: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

/** Candidate education entry. */
export const educationSchema = new Schema(
  {
    degree: { type: String, trim: true, required: true },
    fieldOfStudy: { type: String, trim: true, default: '' },
    institution: { type: String, trim: true, required: true },
    startYear: { type: Number, min: 1950 },
    endYear: { type: Number, min: 1950 },
    grade: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
  },
  { _id: true },
);

/** Candidate work experience entry. */
export const workExperienceSchema = new Schema(
  {
    jobTitle: { type: String, trim: true, required: true },
    company: { type: String, trim: true, required: true },
    location: { type: String, trim: true, default: '' },
    startDate: { type: Date },
    endDate: { type: Date },
    isCurrent: { type: Boolean, default: false },
    description: { type: String, trim: true, default: '' },
  },
  { _id: true },
);

/** Candidate certification entry. */
export const certificationSchema = new Schema(
  {
    name: { type: String, trim: true, required: true },
    issuer: { type: String, trim: true, default: '' },
    issueDate: { type: Date },
    expiryDate: { type: Date },
    credentialId: { type: String, trim: true, default: '' },
    credentialUrl: { type: String, trim: true, default: '' },
  },
  { _id: true },
);

/** Structured language proficiency. */
export const languageSchema = new Schema(
  {
    name: { type: String, trim: true, required: true },
    proficiency: {
      type: String,
      enum: ['basic', 'conversational', 'fluent', 'native'],
      default: 'conversational',
    },
  },
  { _id: false },
);

/** Job / company location snapshot (denormalized for search). */
export const jobLocationSchema = new Schema(
  {
    locationId: { type: Schema.Types.ObjectId, ref: 'Location' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: '' },
    area: { type: String, trim: true, default: '' },
    displayName: { type: String, trim: true, default: '' },
  },
  { _id: false },
);
