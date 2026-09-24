import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { CURRENCIES } from '../constants/enums';

/**
 * Promo coupons for subscription pricing (sheet 348).
 * Applied at activation / checkout preview; amount is discounted server-side.
 */
const couponSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },
    description: { type: String, trim: true, default: '', maxlength: 500 },
    /** percent = 1–100 off list price; fixed = INR amount off. */
    type: {
      type: String,
      enum: ['percent', 'fixed'],
      required: true,
    },
    value: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      enum: CURRENCIES,
      default: 'INR',
    },
    /** Empty = all plans. */
    applicablePlanIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'SubscriptionPlan' }],
      default: [],
    },
    minAmount: { type: Number, min: 0, default: 0 },
    maxRedemptions: { type: Number, min: 0, default: 0 },
    redeemedCount: { type: Number, min: 0, default: 0 },
    validFrom: { type: Date, default: null },
    validTo: { type: Date, default: null },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  {
    timestamps: true,
    collection: 'coupons',
  },
);

couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ status: 1, validTo: 1 });

export type ICoupon = InferSchemaType<typeof couponSchema>;
export type CouponModel = Model<ICoupon>;

export const Coupon: CouponModel =
  (models.Coupon as CouponModel) || model<ICoupon>('Coupon', couponSchema);
