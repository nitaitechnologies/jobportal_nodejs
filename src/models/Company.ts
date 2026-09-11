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
