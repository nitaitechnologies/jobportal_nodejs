import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import {
  ACCOUNT_STATUSES,
  COMPANY_SIZES,
  VERIFICATION_STATUSES,
} from '../constants/enums';
import { socialLinksSchema } from './shared/subschemas';
import { slugify } from '../utils/slug';

const companySchema = new Schema(
  {
    name: {
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
      maxlength: 220,
    },
    logo: { type: String, trim: true, default: '' },
    coverImage: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '', maxlength: 10000 },
    website: { type: String, trim: true, default: '' },
    industry: { type: String, trim: true, default: '' },
    companySize: { type: String, enum: COMPANY_SIZES },
    foundedYear: { type: Number, min: 1800, max: 2100 },
    headquarters: { type: String, trim: true, default: '' },
    locations: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    contactPhone: { type: String, trim: true, default: '' },
    socialLinks: { type: socialLinksSchema, default: () => ({}) },
    /** Company-level benefits shown on public profile (sheet 138). */
    benefits: {
      type: [{ type: String, trim: true, maxlength: 120 }],
      default: [],
    },
    /**
     * Photos/videos gallery (sheet 137).
     * URLs only — employer PATCH or media upload appends here.
     */
    gallery: {
      type: [
        {
          url: { type: String, trim: true, required: true, maxlength: 500 },
          type: { type: String, enum: ['image', 'video'], default: 'image' },
          caption: { type: String, trim: true, default: '', maxlength: 200 },
          sortOrder: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    /** Denormalized aggregates from published CompanyReview (sheet 140). */
    ratingAvg: { type: Number, min: 0, max: 5, default: 0 },
    ratingCount: { type: Number, min: 0, default: 0 },
    /** Homepage / discovery featured flag (sheet 420). Default false — additive. */
    featured: { type: Boolean, default: false },
    featuredAt: { type: Date, default: null },
    /** Company PAN (sheet 176) — stored uppercase, never public. */
    pan: { type: String, trim: true, uppercase: true, default: '', maxlength: 10 },
    /** GSTIN (sheet 176) — stored uppercase, never public. */
    gstin: { type: String, trim: true, uppercase: true, default: '', maxlength: 15 },
    /**
     * KYC documents (sheet 177).
     * Private media refs only — never exposed on public company APIs.
     */
    documents: {
      type: [
        {
          type: {
            type: String,
            enum: ['pan', 'gst', 'incorporation', 'other'],
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
    verificationStatus: {
      type: String,
      enum: VERIFICATION_STATUSES,
      default: 'unverified',
    },
    status: {
      type: String,
      enum: ACCOUNT_STATUSES,
      default: 'active',
    },
  },
  {
    timestamps: true,
    collection: 'companies',
  },
);

companySchema.pre('validate', function preValidate() {
  if (this.name && !this.slug) {
    this.slug = slugify(this.name);
  }
});

companySchema.index({ slug: 1 }, { unique: true });
companySchema.index({ name: 1 });
companySchema.index({ verificationStatus: 1, status: 1 });
companySchema.index({ industry: 1 });

export type ICompany = InferSchemaType<typeof companySchema>;
export type CompanyModel = Model<ICompany>;

export const Company: CompanyModel =
  (models.Company as CompanyModel) || model<ICompany>('Company', companySchema);
