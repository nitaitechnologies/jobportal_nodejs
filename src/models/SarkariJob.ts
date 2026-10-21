import { createHash } from 'crypto';
import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { slugify } from '../utils/slug';

const eligibilitySchema = new Schema(
  {
    education: { type: String, default: null },
    minAge: { type: String, default: null },
    maxAge: { type: String, default: null },
    ageRelaxation: { type: String, default: null },
    experience: { type: String, default: null },
    nationality: { type: String, default: null },
  },
  { _id: false },
);

const postVacancySchema = new Schema(
  {
    post: { type: String, required: true },
    vacancies: { type: Number, required: true },
  },
  { _id: false },
);

const sarkariJobSchema = new Schema(
  {
    externalId: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    postName: { type: String, default: null },
    department: { type: String, default: null },
    board: { type: String, default: null },
    notificationNumber: { type: String, default: null },
    notificationDate: { type: String, default: null },
    applicationStartDate: { type: String, default: null },
    applicationLastDate: { type: String, default: null },
    feeLastDate: { type: String, default: null },
    examDate: { type: String, default: null },
    admitCardDate: { type: String, default: null },
    totalVacancies: { type: Schema.Types.Mixed, default: null },
    categoryWiseVacancies: { type: Schema.Types.Mixed, default: null },
    postWiseVacancies: { type: [postVacancySchema], default: [] },
    location: { type: String, default: null },
    eligibility: { type: eligibilitySchema, default: () => ({}) },
    applicationFee: { type: String, default: null },
    paymentMode: { type: String, default: null },
    selectionProcess: { type: Schema.Types.Mixed, default: null },
    salary: { type: String, default: null },
    documentsRequired: { type: String, default: null },
    applicationSteps: { type: String, default: null },
    notificationPdfUrl: { type: String, default: null },
    applyOnlineUrl: { type: String, default: null },
    shortInformation: { type: String, default: null },
    listingDate: { type: String, default: null },
    publishedAt: { type: Date, default: null },
    lastVerifiedAt: { type: Date, default: null },
    /** Internal only — never expose in public API */
    sourceUrl: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: 'sarkari_jobs',
  },
);

sarkariJobSchema.index({ externalId: 1 }, { unique: true });
sarkariJobSchema.index({ slug: 1 }, { unique: true });
sarkariJobSchema.index({ isActive: 1, publishedAt: -1 });
sarkariJobSchema.index({ isActive: 1, applicationLastDate: 1 });
sarkariJobSchema.index({ title: 'text', postName: 'text', board: 'text', department: 'text' });

export function buildSarkariSlug(title: string, externalId: string): string {
  const base = slugify(title).slice(0, 80) || 'sarkari-job';
  const hash = createHash('sha1').update(externalId).digest('hex').slice(0, 8);
  return `${base}-${hash}`;
}

export type ISarkariJob = InferSchemaType<typeof sarkariJobSchema>;
export type SarkariJobModel = Model<ISarkariJob>;

export const SarkariJob: SarkariJobModel =
  (models.SarkariJob as SarkariJobModel) || model<ISarkariJob>('SarkariJob', sarkariJobSchema);
