import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { BILLING_CYCLES, CURRENCIES, PLAN_STATUSES } from '../constants/enums';
import { slugify } from '../utils/slug';

const planLimitsSchema = new Schema(
  {
    jobPostLimit: { type: Number, min: 0, default: 5 },
    activeJobLimit: { type: Number, min: 0, default: 3 },
    featuredJobLimit: { type: Number, min: 0, default: 0 },
    /** Max days a published listing stays live (0 = use application deadline only). Free = 10. */
    jobListingLifetimeDays: { type: Number, min: 0, max: 3660, default: 0 },
    /** Max candidate contact unlocks per billing period. */
    contactUnlockLimit: { type: Number, min: 0, default: 0 },
    /** Max candidate search results for free/basic search (sheet 371). 0 = unlimited. */
    freeSearchResultLimit: { type: Number, min: 0, default: 25 },
  },
  { _id: false },
);

const planFeaturesSchema = new Schema(
  {
    featuredJobs: { type: Boolean, default: false },
    candidateContact: { type: Boolean, default: false },
    /** Full candidate database filters + higher result caps (sheet 372). */
    advancedCandidateSearch: { type: Boolean, default: false },
  },
  { _id: false },
);

const subscriptionPlanSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 140,
    },
    description: { type: String, trim: true, default: '', maxlength: 2000 },
    price: { type: Number, min: 0, required: true, default: 0 },
    currency: {
      type: String,
      enum: CURRENCIES,
      default: 'INR',
    },
    billingCycle: {
      type: String,
      enum: BILLING_CYCLES,
      default: 'monthly',
    },
    durationDays: { type: Number, min: 1, max: 3660, required: true, default: 30 },
    features: { type: planFeaturesSchema, default: () => ({}) },
    limits: { type: planLimitsSchema, default: () => ({}) },
    status: {
      type: String,
      enum: PLAN_STATUSES,
      default: 'active',
    },
    sortOrder: { type: Number, default: 0 },
    /** `legacy` keeps older starter/professional plans. `hiring` is the public pricing catalog. */
    catalog: { type: String, enum: ['legacy', 'hiring'], default: 'legacy' },
    /** Which hiring requirement this offer belongs to. */
    hiringIntent: { type: String, enum: ['single', 'multi', null], default: null },
    offerType: { type: String, enum: ['plan', 'topup'], default: 'plan' },
    /** Shown as ₹X/month. `price` is the upfront amount. */
    monthlyPrice: { type: Number, min: 0, default: 0 },
    /** Discounted charge when the company already has a live plan. */
    upgradePrice: { type: Number, min: 0 },
    available: { type: Boolean, default: true },
    popular: { type: Boolean, default: false },
    badge: { type: String, trim: true, default: '', maxlength: 40 },
    highlights: { type: [String], default: [] },
  },
  {
    timestamps: true,
    collection: 'subscription_plans',
  },
);

subscriptionPlanSchema.pre('validate', function preValidate() {
  if (this.name && !this.slug) {
    this.slug = slugify(this.name);
  }
});

subscriptionPlanSchema.index({ slug: 1 }, { unique: true });
subscriptionPlanSchema.index({ status: 1, sortOrder: 1 });
subscriptionPlanSchema.index({ catalog: 1, hiringIntent: 1, sortOrder: 1 });

export type ISubscriptionPlan = InferSchemaType<typeof subscriptionPlanSchema>;
export type SubscriptionPlanModel = Model<ISubscriptionPlan>;

export const SubscriptionPlan: SubscriptionPlanModel =
  (models.SubscriptionPlan as SubscriptionPlanModel) ||
  model<ISubscriptionPlan>('SubscriptionPlan', subscriptionPlanSchema);
