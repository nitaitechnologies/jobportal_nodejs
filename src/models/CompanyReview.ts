import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

export const COMPANY_REVIEW_STATUSES = ['published', 'hidden'] as const;
export type CompanyReviewStatus = (typeof COMPANY_REVIEW_STATUSES)[number];

const companyReviewSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    body: {
      type: String,
      trim: true,
      required: true,
      maxlength: 5000,
    },
    status: {
      type: String,
      enum: COMPANY_REVIEW_STATUSES,
      default: 'published',
    },
  },
  {
    timestamps: true,
    collection: 'company_reviews',
  },
);

companyReviewSchema.index({ companyId: 1, status: 1, createdAt: -1 });
companyReviewSchema.index({ companyId: 1, candidateId: 1 }, { unique: true });
companyReviewSchema.index({ candidateId: 1, createdAt: -1 });

export type ICompanyReview = InferSchemaType<typeof companyReviewSchema>;
export type CompanyReviewModel = Model<ICompanyReview>;

export const CompanyReview: CompanyReviewModel =
  (models.CompanyReview as CompanyReviewModel) ||
  model<ICompanyReview>('CompanyReview', companyReviewSchema);
