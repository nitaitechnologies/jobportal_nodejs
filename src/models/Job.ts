import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import {
  APPLICATION_METHODS,
  EMPLOYMENT_TYPES,
  GENDERS,
  JOB_SHIFTS,
  JOB_STATUSES,
  SALARY_PERIODS,
  WORK_MODES,
  WORKING_DAY_PREFERENCES,
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
    /** Employer-defined screening questions (sheet 259–262). */
    screeningQuestions: {
      type: [
        {
          id: { type: String, trim: true, required: true, maxlength: 64 },
          text: { type: String, trim: true, required: true, maxlength: 500 },
          required: { type: Boolean, default: false },
          type: {
            type: String,
            enum: ['text', 'experience', 'salary', 'joining', 'skill'],
            default: 'text',
          },
        },
      ],
      default: [],
    },
    /** Auto-filter low-fit applications on apply (sheet 263). */
    screeningAutoFilter: {
      enabled: { type: Boolean, default: false },
      minMatchScore: { type: Number, min: 0, max: 100, default: 40 },
    },
    shift: {
      type: String,
      enum: JOB_SHIFTS,
      trim: true,
    },
    workingDays: {
      type: [{ type: String, enum: WORKING_DAY_PREFERENCES }],
      default: [],
    },
    /** Free-text hours e.g. "9:00 AM – 6:00 PM". */
    workingHours: { type: String, trim: true, default: '', maxlength: 120 },
    genderPreference: {
      type: String,
      enum: [...GENDERS, 'any'],
      default: 'any',
    },
    benefits: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    /** Whether pay includes incentives / performance bonus. */
    incentives: { type: Boolean, default: false },
    /** Short description of interview rounds / process. */
    interviewProcess: { type: String, trim: true, default: '', maxlength: 2000 },
    /** Saved AI Interview question kit (sheet 301–303). */
    aiInterviewKit: {
      role: { type: String, trim: true, default: '', maxlength: 200 },
      experienceYears: { type: Number, min: 0, max: 50, default: null },
      skills: { type: [{ type: String, trim: true }], default: [] },
      questions: {
        type: [
          {
            id: { type: String, trim: true, required: true, maxlength: 64 },
            text: { type: String, trim: true, required: true, maxlength: 500 },
            category: { type: String, trim: true, default: 'general', maxlength: 80 },
            difficulty: {
              type: String,
              enum: ['easy', 'medium', 'hard'],
              default: 'medium',
            },
          },
        ],
        default: [],
      },
      savedAt: { type: Date },
      model: { type: String, trim: true, default: '', maxlength: 80 },
      aiGenerated: { type: Boolean, default: true },
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
    /** When featured/boost was last turned on (sheet 314–320). */
    featuredAt: { type: Date, default: null },
    /** Snapshot of metrics at featuredAt for boost performance (320). */
    boostBaseline: {
      views: { type: Number, min: 0, default: 0 },
      applicationsCount: { type: Number, min: 0, default: 0 },
      capturedAt: { type: Date, default: null },
    },
    /** Last targeted boost notify to matching candidates (319). */
    boostNotifySentAt: { type: Date, default: null },
    boostNotifyCount: { type: Number, min: 0, default: 0 },
    views: { type: Number, min: 0, default: 0 },
    applicationsCount: { type: Number, min: 0, default: 0 },
    publishedAt: { type: Date },
    expiresAt: { type: Date },
    /** Extra post-quota charges after the initial create (e.g. renewals). */
    renewalCount: { type: Number, min: 0, default: 0 },
    lastRenewedAt: { type: Date },
    /** When we last notified the employer that this listing is nearing expiry. */
    expiryReminderSentAt: { type: Date },
    /** Team members assigned to this job (sheet 337). */
    assignedEmployerIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Employer' }],
      default: [],
    },
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
jobSchema.index({ education: 1, status: 1 });
jobSchema.index({ shift: 1, status: 1 });
jobSchema.index({ workingDays: 1, status: 1 });
jobSchema.index({ applicationMethod: 1, status: 1 });
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
