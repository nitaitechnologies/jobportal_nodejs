import mongoose from 'mongoose';
import { Company } from '../models/Company';
import { Invoice } from '../models/Invoice';
import { Payment } from '../models/Payment';

type PaymentDoc = InstanceType<typeof Payment>;

/** Default GST rate for B2B invoices (18% IGST when interstate / unknown). */
export const DEFAULT_GST_RATE = 18;

export type TaxBreakdown = {
  taxableAmount: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxAmount: number;
  totalAmount: number;
};

export function computeGstBreakdown(
  taxableAmount: number,
  opts: { hasGstin?: boolean } = {},
): TaxBreakdown {
  const taxable = Math.max(0, Math.round(taxableAmount));
  // With GSTIN: CGST+SGST 9+9; without: IGST 18 (placeholder until place-of-supply).
  if (opts.hasGstin) {
    const cgstRate = 9;
    const sgstRate = 9;
    const cgstAmount = Math.round((taxable * cgstRate) / 100);
    const sgstAmount = Math.round((taxable * sgstRate) / 100);
    const taxAmount = cgstAmount + sgstAmount;
    return {
      taxableAmount: taxable,
      cgstRate,
      sgstRate,
      igstRate: 0,
      cgstAmount,
      sgstAmount,
      igstAmount: 0,
      taxAmount,
      totalAmount: taxable + taxAmount,
    };
  }

  const igstRate = DEFAULT_GST_RATE;
  const igstAmount = Math.round((taxable * igstRate) / 100);
  return {
    taxableAmount: taxable,
    cgstRate: 0,
    sgstRate: 0,
    igstRate,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount,
    taxAmount: igstAmount,
    totalAmount: taxable + igstAmount,
  };
}

async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `WI-${year}-`;
  const latest = await Invoice.findOne({ invoiceNumber: { $regex: `^${prefix}` } })
    .sort({ invoiceNumber: -1 })
    .select('invoiceNumber');
  let seq = 1;
  if (latest?.invoiceNumber) {
    const part = latest.invoiceNumber.slice(prefix.length);
    const n = Number.parseInt(part, 10);
    if (Number.isFinite(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(5, '0')}`;
}

export function mapInvoice(doc: {
  _id: { toString(): string };
  companyId: { toString(): string };
  paymentId: { toString(): string };
  invoiceNumber: string;
  status?: string;
  issuedAt: Date;
  billingName?: string | null;
  billingGstin?: string | null;
  billingAddress?: string | null;
  description?: string | null;
  currency?: string | null;
  taxableAmount: number;
  cgstRate?: number | null;
  sgstRate?: number | null;
  igstRate?: number | null;
  cgstAmount?: number | null;
  sgstAmount?: number | null;
  igstAmount?: number | null;
  taxAmount?: number | null;
  totalAmount: number;
  discountAmount?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: doc._id.toString(),
    companyId: doc.companyId.toString(),
    paymentId: doc.paymentId.toString(),
    invoiceNumber: doc.invoiceNumber,
    status: doc.status ?? 'issued',
    issuedAt: doc.issuedAt,
    billingName: doc.billingName ?? '',
    billingGstin: doc.billingGstin ?? '',
    billingAddress: doc.billingAddress ?? '',
    description: doc.description ?? '',
    currency: doc.currency ?? 'INR',
    taxableAmount: doc.taxableAmount,
    cgstRate: doc.cgstRate ?? 0,
    sgstRate: doc.sgstRate ?? 0,
    igstRate: doc.igstRate ?? 0,
    cgstAmount: doc.cgstAmount ?? 0,
    sgstAmount: doc.sgstAmount ?? 0,
    igstAmount: doc.igstAmount ?? 0,
    taxAmount: doc.taxAmount ?? 0,
    totalAmount: doc.totalAmount,
    discountAmount: doc.discountAmount ?? 0,
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}

export async function issueInvoiceForPayment(payment: PaymentDoc, description: string) {
  const company = await Company.findById(payment.companyId).select(
    'name gstin headquarters location',
  );
  const gstin = company?.gstin?.trim() || '';
  const tax = computeGstBreakdown(payment.taxableAmount ?? 0, {
    hasGstin: Boolean(gstin),
  });

  // Keep payment tax fields aligned with issued invoice.
  payment.cgstAmount = tax.cgstAmount;
  payment.sgstAmount = tax.sgstAmount;
  payment.igstAmount = tax.igstAmount;
  payment.taxAmount = tax.taxAmount;
  payment.totalAmount = tax.totalAmount;

  const invoiceNumber = await nextInvoiceNumber();
  const invoice = await Invoice.create({
    companyId: payment.companyId,
    paymentId: payment._id,
    invoiceNumber,
    status: 'issued',
    issuedAt: new Date(),
    billingName: company?.name ?? '',
    billingGstin: gstin,
    billingAddress: company?.headquarters || '',
    description,
    currency: payment.currency ?? 'INR',
    taxableAmount: tax.taxableAmount,
    cgstRate: tax.cgstRate,
    sgstRate: tax.sgstRate,
    igstRate: tax.igstRate,
    cgstAmount: tax.cgstAmount,
    sgstAmount: tax.sgstAmount,
    igstAmount: tax.igstAmount,
    taxAmount: tax.taxAmount,
    totalAmount: tax.totalAmount,
    discountAmount: payment.discountAmount ?? 0,
  });

  payment.invoiceId = invoice._id as mongoose.Types.ObjectId;
  await payment.save();

  return invoice;
}

export class InvoiceService {
  async list(companyId: string, query: { page: number; limit: number }) {
    const filter = { companyId: new mongoose.Types.ObjectId(companyId) };
    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      Invoice.countDocuments(filter),
      Invoice.find(filter).sort({ issuedAt: -1 }).skip(skip).limit(query.limit),
    ]);
    return {
      invoices: rows.map((row) => mapInvoice(row)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getById(companyId: string, id: string) {
    const invoice = await Invoice.findOne({
      _id: id,
      companyId,
    });
    if (!invoice) return null;
    return { invoice: mapInvoice(invoice) };
  }
}

export const invoiceService = new InvoiceService();
