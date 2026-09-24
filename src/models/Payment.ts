import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { CURRENCIES, PAYMENT_KINDS, PAYMENT_STATUSES } from '../constants/enums';

/**
 * Employer payment record (sheet 359–365).
 * Provider is `simulated` until a real gateway (358) is added.
 */
const paymentSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    employerId: { type: Schema.Types.ObjectId, ref: 'Employer', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: PAYMENT_KINDS, required: true },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
    /** List / pack price before discount + tax. */
    amount: { type: Number, min: 0, required: true },
    discountAmount: { type: Number, min: 0, default: 0 },
    taxableAmount: { type: Number, min: 0, default: 0 },
    cgstAmount: { type: Number, min: 0, default: 0 },
    sgstAmount: { type: Number, min: 0, default: 0 },
    igstAmount: { type: Number, min: 0, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    totalAmount: { type: Number, min: 0, required: true },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    couponCode: { type: String, trim: true, uppercase: true, default: '' },
    planId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', default: null },
    creditPackId: { type: String, trim: true, default: '' },
    credits: { type: Number, min: 0, default: 0 },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', default: null },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null },
    paymentProvider: { type: String, trim: true, default: 'simulated' },
    externalPaymentId: { type: String, trim: true, default: '' },
    failureReason: { type: String, trim: true, default: '', maxlength: 500 },
    refundedAmount: { type: Number, min: 0, default: 0 },
    refundedAt: { type: Date, default: null },
    refundReason: { type: String, trim: true, default: '', maxlength: 500 },
    description: { type: String, trim: true, default: '', maxlength: 300 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    confirmedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'payments',
  },
);

paymentSchema.index({ companyId: 1, createdAt: -1 });
paymentSchema.index({ companyId: 1, status: 1 });
paymentSchema.index({ status: 1, kind: 1 });

export type IPayment = InferSchemaType<typeof paymentSchema>;
export type PaymentModel = Model<IPayment>;

export const Payment: PaymentModel =
  (models.Payment as PaymentModel) || model<IPayment>('Payment', paymentSchema);
