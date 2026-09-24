import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { CURRENCIES, INVOICE_STATUSES } from '../constants/enums';

/**
 * GST tax invoice for a succeeded payment (sheet 361).
 */
const invoiceSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', required: true },
    invoiceNumber: { type: String, required: true, trim: true, maxlength: 40 },
    status: { type: String, enum: INVOICE_STATUSES, default: 'issued' },
    issuedAt: { type: Date, required: true },
    billingName: { type: String, trim: true, default: '', maxlength: 200 },
    billingGstin: { type: String, trim: true, uppercase: true, default: '', maxlength: 15 },
    billingAddress: { type: String, trim: true, default: '', maxlength: 500 },
    description: { type: String, trim: true, default: '', maxlength: 300 },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    taxableAmount: { type: Number, min: 0, required: true },
    cgstRate: { type: Number, min: 0, max: 100, default: 0 },
    sgstRate: { type: Number, min: 0, max: 100, default: 0 },
    igstRate: { type: Number, min: 0, max: 100, default: 0 },
    cgstAmount: { type: Number, min: 0, default: 0 },
    sgstAmount: { type: Number, min: 0, default: 0 },
    igstAmount: { type: Number, min: 0, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    totalAmount: { type: Number, min: 0, required: true },
    discountAmount: { type: Number, min: 0, default: 0 },
  },
  {
    timestamps: true,
    collection: 'invoices',
  },
);

invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ companyId: 1, issuedAt: -1 });
invoiceSchema.index({ paymentId: 1 }, { unique: true });

export type IInvoice = InferSchemaType<typeof invoiceSchema>;
export type InvoiceModel = Model<IInvoice>;

export const Invoice: InvoiceModel =
  (models.Invoice as InvoiceModel) || model<IInvoice>('Invoice', invoiceSchema);
