import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { BILLING_CYCLES, CURRENCIES, SUBSCRIPTION_STATUSES } from '../constants/enums';

const subscriptionLimitsSchema = new Schema(
  {
    jobPostLimit: { type: Number, min: 0, default: 0 },
    activeJobLimit: { type: Number, min: 0, default: 0 },
    featuredJobLimit: { type: Number, min: 0, default: 0 },
    jobListingLifetimeDays: { type: Number, min: 0, max: 3660, default: 0 },
  },
  { _id: false },
);

/**
 * Employer/company subscription.
 * `plan` stores the plan slug snapshot; `planId` references SubscriptionPlan.
 * Payment provider fields remain placeholders (no gateway in B20).
 */
const subscriptionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
    },
    plan: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    status: {
      type: String,
      enum: SUBSCRIPTION_STATUSES,
      default: 'trial',
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    amount: { type: Number, min: 0, default: 0 },
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
    autoRenew: { type: Boolean, default: false },
    paymentProvider: { type: String, trim: true, default: '' },
    externalSubscriptionId: { type: String, trim: true, default: '' },
    features: {
      type: Schema.Types.Mixed,
      default: {},
    },
    limits: {
      type: subscriptionLimitsSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    collection: 'subscriptions',
  },
);

subscriptionSchema.index({ companyId: 1, status: 1 });
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ status: 1, endDate: 1 });
subscriptionSchema.index({ planId: 1 });
subscriptionSchema.index({ companyId: 1, createdAt: -1 });
subscriptionSchema.index({ externalSubscriptionId: 1 }, { sparse: true });

export type ISubscription = InferSchemaType<typeof subscriptionSchema>;
export type SubscriptionModel = Model<ISubscription>;

export const Subscription: SubscriptionModel =
  (models.Subscription as SubscriptionModel) ||
  model<ISubscription>('Subscription', subscriptionSchema);
