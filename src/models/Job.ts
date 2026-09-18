import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import {
  APPLICATION_METHODS,
  EMPLOYMENT_TYPES,
  GENDERS,
  JOB_STATUSES,
  SALARY_PERIODS,
  WORK_MODES,
} from '../constants/enums';
import { jobLocationSchema } from './shared/subschemas';
import { slugify } from '../utils/slug';

const jobSchema = new Schema(
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
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 240,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20000,
    },
    /** Public media URL or media: ref for short video JD (max 2MB / 40s when enabled). */
    videoJd: { type: String, trim: true, default: '' },
    responsibilities: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    requirements: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    skills: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
    },
    location: { type: jobLocationSchema, default: () => ({}) },
    workMode: {
      type: String,
      enum: WORK_MODES,
      required: true,
    },
    employmentType: {
      type: String,
      enum: EMPLOYMENT_TYPES,
      required: true,
    },
    experienceMin: { type: Number, min: 0, default: 0 },
    experienceMax: { type: Number, min: 0 },
    salaryMin: { type: Number, min: 0 },
    salaryMax: { type: Number, min: 0 },
    salaryPeriod: {
      type: String,
      enum: SALARY_PERIODS,
      default: 'monthly',
    },
    openings: { type: Number, min: 1, default: 1 },
    education: { type: String, trim: true, default: '' },
    genderPreference: {
      type: String,
      enum: [...GENDERS, 'any'],
      default: 'any',
    },
    benefits: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    applicationDeadline: { type: Date },
    applicationMethod: {
      type: String,
      enum: APPLICATION_METHODS,
      default: 'platform',
    },
    status: {
      type: String,
      enum: JOB_STATUSES,
      default: 'draft',
    },
    featured: { type: Boolean, default: false },
    urgent: { type: Boolean, default: false },
    views: { type: Number, min: 0, default: 0 },
    applicationsCount: { type: Number, min: 0, default: 0 },
    publishedAt: { type: Date },
    expiresAt: { type: Date },
    /** Extra post-quota charges after the initial create (e.g. renewals). */
    renewalCount: { type: Number, min: 0, default: 0 },
    lastRenewedAt: { type: Date },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'jobs',
  },
);

jobSchema.pre('validate', function preValidate() {
  if (this.title && !this.slug) {
    this.slug = slugify(this.title);
  }
});

jobSchema.index({ slug: 1 }, { unique: true });
jobSchema.index({ companyId: 1, status: 1 });
jobSchema.index({ employerId: 1, status: 1, deletedAt: 1 });
jobSchema.index({ categoryId: 1, status: 1 });
jobSchema.index({ status: 1, publishedAt: -1 });
jobSchema.index({ status: 1, featured: 1, createdAt: -1 });
jobSchema.index({ workMode: 1, employmentType: 1, status: 1 });
jobSchema.index({ 'location.city': 1, status: 1 });
jobSchema.index({ 'location.locationId': 1, status: 1 });
jobSchema.index({ experienceMin: 1, experienceMax: 1 });
jobSchema.index({ salaryMin: 1, salaryMax: 1 });
jobSchema.index({ skills: 1 });
jobSchema.index(
  {
    title: 'text',
    description: 'text',
    skills: 'text',
    requirements: 'text',
    responsibilities: 'text',
  },
  {
    weights: {
      title: 10,
      skills: 5,
      requirements: 3,
      responsibilities: 2,
      description: 1,
    },
    name: 'job_text_search',
  },
);
jobSchema.index({ status: 1, deletedAt: 1, publishedAt: -1 });
jobSchema.index({ status: 1, featured: 1, urgent: 1, publishedAt: -1 });

export type IJob = InferSchemaType<typeof jobSchema>;
export type JobModel = Model<IJob>;

export const Job: JobModel = (models.Job as JobModel) || model<IJob>('Job', jobSchema);
