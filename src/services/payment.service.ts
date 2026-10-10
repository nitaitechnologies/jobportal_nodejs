import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import { env } from '../config/env';
import { resolveCreditPackById, resolveCreditPacks } from './creditCatalog.service';
import { Company } from '../models/Company';
import { Invoice } from '../models/Invoice';
import { Payment } from '../models/Payment';
import { WalletTransaction } from '../models/CompanyWallet';
import { SubscriptionPlan } from '../models/SubscriptionPlan';
import type { AuthenticatedEmployer } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { mapEmployerSubscription } from '../utils/subscriptionMapper';
import { resolveCouponPricing } from './coupon.service';
import {
  computeGstBreakdown,
  issueInvoiceForPayment,
  mapInvoice,
} from './invoice.service';
import { activateSubscription } from './subscription.service';
import { walletService } from './wallet.service';
import { notifySafely } from './notification.service';
import {
  createRazorpayOrder,
  razorpayConfigured,
  refundRazorpayPayment,
  signCheckoutToken,
  verifyCheckoutToken,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhook,
} from './paymentGateway.service';
import type {
  PaymentCheckoutInput,
  PaymentConfirmInput,
  PaymentFailInput,
  PaymentQuery,
  PaymentRefundInput,
} from '../validators/payment.validator';

function mapPayment(doc: {
  _id: { toString(): string };
  companyId: { toString(): string };
  employerId: { toString(): string };
  userId: { toString(): string };
  kind: string;
  status?: string;
  amount: number;
  discountAmount?: number | null;
  taxableAmount?: number | null;
  cgstAmount?: number | null;
  sgstAmount?: number | null;
  igstAmount?: number | null;
  taxAmount?: number | null;
  totalAmount: number;
  currency?: string | null;
  couponCode?: string | null;
  planId?: { toString(): string } | null;
  creditPackId?: string | null;
  credits?: number | null;
  subscriptionId?: { toString(): string } | null;
  invoiceId?: { toString(): string } | null;
  paymentProvider?: string | null;
  externalPaymentId?: string | null;
  failureReason?: string | null;
  refundedAmount?: number | null;
  refundedAt?: Date | null;
  refundReason?: string | null;
  description?: string | null;
  confirmedAt?: Date | null;
  failedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: doc._id.toString(),
    companyId: doc.companyId.toString(),
    employerId: doc.employerId.toString(),
    userId: doc.userId.toString(),
    kind: doc.kind,
    status: doc.status ?? 'pending',
    amount: doc.amount,
    discountAmount: doc.discountAmount ?? 0,
    taxableAmount: doc.taxableAmount ?? 0,
    cgstAmount: doc.cgstAmount ?? 0,
    sgstAmount: doc.sgstAmount ?? 0,
    igstAmount: doc.igstAmount ?? 0,
    taxAmount: doc.taxAmount ?? 0,
    totalAmount: doc.totalAmount,
    currency: doc.currency ?? 'INR',
    couponCode: doc.couponCode ?? '',
    planId: doc.planId ? doc.planId.toString() : null,
    creditPackId: doc.creditPackId ?? '',
    credits: doc.credits ?? 0,
    subscriptionId: doc.subscriptionId ? doc.subscriptionId.toString() : null,
    invoiceId: doc.invoiceId ? doc.invoiceId.toString() : null,
    paymentProvider: doc.paymentProvider ?? 'simulated',
    externalPaymentId: doc.externalPaymentId ?? '',
    failureReason: doc.failureReason ?? '',
    refundedAmount: doc.refundedAmount ?? 0,
    refundedAt: doc.refundedAt ?? null,
    refundReason: doc.refundReason ?? '',
    description: doc.description ?? '',
    confirmedAt: doc.confirmedAt ?? null,
    failedAt: doc.failedAt ?? null,
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}

async function companyHasGstin(companyId: string): Promise<boolean> {
  const company = await Company.findById(companyId).select('gstin');
  return Boolean(company?.gstin?.trim());
}

export class PaymentService {
  async listCreditPacks() {
    const packs = await resolveCreditPacks();
    return {
      packs: packs.map((pack) => ({ ...pack })),
      note: razorpayConfigured()
        ? 'Prices are taxable; GST is added at checkout. Payments are collected via Razorpay.'
        : 'Prices are taxable; GST is added at checkout. Gateway keys are not set, so checkout stays simulated.',
    };
  }

  async checkout(employer: AuthenticatedEmployer, input: PaymentCheckoutInput) {
    const hasGstin = await companyHasGstin(employer.companyId);
    let amount = 0;
    let discountAmount = 0;
    let couponCode = '';
    let planId: mongoose.Types.ObjectId | null = null;
    let creditPackId = '';
    let credits = 0;
    let description = '';
    let currency: 'INR' = 'INR';

    if (input.kind === 'subscription') {
      const plan = await SubscriptionPlan.findById(input.planId);
      if (!plan || plan.status !== 'active') {
        throw new AppError('Subscription plan not found', HTTP_STATUS.NOT_FOUND);
      }
      amount = plan.price ?? 0;
      currency = (plan.currency as 'INR') || 'INR';
      planId = plan._id as mongoose.Types.ObjectId;
      description = `Subscription: ${plan.name}`;

      const code = input.couponCode?.trim();
      if (code) {
        const pricing = await resolveCouponPricing(code, plan._id.toString(), {
          consume: false,
        });
        amount = pricing.originalAmount;
        discountAmount = pricing.discountAmount;
        couponCode = pricing.code;
      }
    } else {
      const pack = await resolveCreditPackById(input.creditPackId ?? '');
      if (!pack) {
        throw new AppError('Credit pack not found', HTTP_STATUS.NOT_FOUND, [
          { path: 'creditPackId', message: 'Unknown credit pack' },
        ]);
      }
      amount = pack.price;
      credits = pack.credits;
      creditPackId = pack.id;
      description = `Credit pack: ${pack.name}`;
    }

    const taxableAmount = Math.max(0, amount - discountAmount);
    const tax = computeGstBreakdown(taxableAmount, { hasGstin });

    const useGateway = razorpayConfigured() && tax.totalAmount >= 1;

    const payment = await Payment.create({
      companyId: new mongoose.Types.ObjectId(employer.companyId),
      employerId: new mongoose.Types.ObjectId(employer.employerId),
      userId: new mongoose.Types.ObjectId(employer.userId),
      kind: input.kind,
      status: 'pending',
      amount,
      discountAmount,
      taxableAmount: tax.taxableAmount,
      cgstAmount: tax.cgstAmount,
      sgstAmount: tax.sgstAmount,
      igstAmount: tax.igstAmount,
      taxAmount: tax.taxAmount,
      totalAmount: tax.totalAmount,
      currency,
      couponCode,
      planId,
      creditPackId,
      credits,
      paymentProvider: useGateway ? 'razorpay' : 'simulated',
      description,
      metadata: {
        autoRenew: Boolean(input.autoRenew),
        simulated: !useGateway,
      },
    });

    let orderId = '';
    let keyId = '';
    if (useGateway) {
      const order = await createRazorpayOrder({
        amountPaise: Math.round(tax.totalAmount * 100),
        receipt: payment._id.toString(),
        notes: {
          paymentId: payment._id.toString(),
          kind: input.kind,
          companyId: employer.companyId,
        },
      });
      orderId = order.orderId;
      keyId = order.keyId;
      payment.set('metadata', {
        ...(payment.metadata as Record<string, unknown>),
        gatewayOrderId: order.orderId,
        simulated: false,
      });
      await payment.save();
    }

    const token = signCheckoutToken(payment._id.toString());
    const checkoutPath = useGateway
      ? `/payments/gateway/${payment._id.toString()}?token=${encodeURIComponent(token)}`
      : '';

    return {
      payment: mapPayment(payment),
      taxBreakdown: tax,
      instructions: {
        provider: useGateway ? 'razorpay' : 'simulated',
        keyId,
        orderId,
        checkoutPath,
        amount: tax.totalAmount,
        currency,
        nextStep: useGateway
          ? 'Open checkoutPath to pay with Razorpay. The app polls payment status after return.'
          : 'POST /employer/payments/:id/confirm to complete (gateway keys are not set). Use /fail to simulate a decline.',
      },
    };
  }

  async confirm(
    employer: AuthenticatedEmployer,
    id: string,
    input: PaymentConfirmInput,
  ) {
    const payment = await Payment.findOne({
      _id: id,
      companyId: employer.companyId,
    });
    if (!payment) {
      throw new AppError('Payment not found', HTTP_STATUS.NOT_FOUND);
    }
    if (payment.status === 'succeeded') {
      return this.buildConfirmResponse(payment);
    }
    if (payment.status !== 'pending') {
      throw new AppError(
        `Payment cannot be confirmed from status "${payment.status}"`,
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    if (payment.paymentProvider === 'razorpay') {
      const orderId =
        input.razorpayOrderId?.trim() ||
        String((payment.metadata as { gatewayOrderId?: string } | undefined)?.gatewayOrderId ?? '');
      const razorpayPaymentId = input.razorpayPaymentId?.trim() || input.externalPaymentId?.trim();
      const signature = input.razorpaySignature?.trim() ?? '';
      if (!orderId || !razorpayPaymentId || !signature) {
        throw new AppError(
          'Razorpay payment id, order id, and signature are required',
          HTTP_STATUS.BAD_REQUEST,
        );
      }
      if (
        !verifyRazorpayPaymentSignature({
          orderId,
          paymentId: razorpayPaymentId,
          signature,
        })
      ) {
        throw new AppError('Payment signature is invalid', HTTP_STATUS.BAD_REQUEST);
      }
      return this.capturePayment(payment, razorpayPaymentId);
    }

    const externalPaymentId =
      input.externalPaymentId?.trim() ||
      `sim_${payment._id.toString()}_${Date.now()}`;

    return this.capturePayment(payment, externalPaymentId);
  }

  private async capturePayment(
    payment: InstanceType<typeof Payment>,
    externalPaymentId: string,
  ) {
    if (payment.status === 'succeeded') {
      return this.buildConfirmResponse(payment);
    }
    if (payment.status !== 'pending') {
      throw new AppError(
        `Payment cannot be confirmed from status "${payment.status}"`,
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    let subscriptionPayload = null;

    if (payment.kind === 'subscription') {
      if (!payment.planId) {
        throw new AppError('Payment is missing planId', HTTP_STATUS.BAD_REQUEST);
      }
      const autoRenew = Boolean(
        (payment.metadata as { autoRenew?: boolean } | undefined)?.autoRenew,
      );
      const subscription = await activateSubscription({
        userId: payment.userId.toString(),
        companyId: payment.companyId.toString(),
        planId: payment.planId.toString(),
        autoRenew,
        couponCode: payment.couponCode || undefined,
        actorRole: 'employer',
      });
      subscription.paymentProvider = payment.paymentProvider || 'simulated';
      subscription.externalSubscriptionId = externalPaymentId;
      await subscription.save();
      payment.subscriptionId = subscription._id as mongoose.Types.ObjectId;
      subscriptionPayload = mapEmployerSubscription(subscription);
    } else {
      const credits = payment.credits ?? 0;
      if (credits <= 0) {
        throw new AppError('Payment has no credits to grant', HTTP_STATUS.BAD_REQUEST);
      }
      await walletService.credit({
        companyId: payment.companyId.toString(),
        credits,
        type: 'purchase',
        paymentId: payment._id.toString(),
        description: payment.description || 'Credit pack purchase',
        metadata: { creditPackId: payment.creditPackId },
      });
    }

    payment.externalPaymentId = externalPaymentId;
    payment.status = 'succeeded';
    payment.confirmedAt = new Date();
    payment.failureReason = '';
    payment.failedAt = null;
    await payment.save();

    const invoice = await issueInvoiceForPayment(
      payment,
      payment.description || `${env.appName} payment`,
    );

    await notifySafely({
      recipientId: payment.userId.toString(),
      type: 'PAYMENT_SUCCEEDED',
      title: 'Payment successful',
      message:
        payment.kind === 'credits'
          ? `Your credit pack purchase of ₹${payment.totalAmount ?? 0} succeeded.`
          : `Your subscription payment of ₹${payment.totalAmount ?? 0} succeeded.`,
      data: {
        paymentId: payment._id.toString(),
        kind: payment.kind,
        amount: payment.totalAmount ?? 0,
      },
    });

    return {
      payment: mapPayment(payment),
      invoice: mapInvoice(invoice),
      subscription: subscriptionPayload,
      wallet:
        payment.kind === 'credits'
          ? (await walletService.getWallet(payment.companyId.toString())).wallet
          : null,
    };
  }

  private async buildConfirmResponse(payment: InstanceType<typeof Payment>) {
    const invoice = payment.invoiceId
      ? await Invoice.findById(payment.invoiceId)
      : null;
    return {
      payment: mapPayment(payment),
      invoice: invoice ? mapInvoice(invoice) : null,
      subscription: null,
      wallet:
        payment.kind === 'credits'
          ? (await walletService.getWallet(payment.companyId.toString())).wallet
          : null,
      alreadyConfirmed: true,
    };
  }

  async fail(employer: AuthenticatedEmployer, id: string, input: PaymentFailInput) {
    const payment = await Payment.findOne({
      _id: id,
      companyId: employer.companyId,
    });
    if (!payment) {
      throw new AppError('Payment not found', HTTP_STATUS.NOT_FOUND);
    }
    if (payment.status === 'failed') {
      return { payment: mapPayment(payment), alreadyFailed: true };
    }
    if (payment.status !== 'pending') {
      throw new AppError(
        `Payment cannot be failed from status "${payment.status}"`,
        HTTP_STATUS.BAD_REQUEST,
      );
    }
    payment.status = 'failed';
    payment.failureReason = input.reason || 'Payment failed';
    payment.failedAt = new Date();
    await payment.save();

    await notifySafely({
      recipientId: employer.userId,
      type: 'PAYMENT_FAILED',
      title: 'Payment failed',
      message: payment.failureReason || 'Your payment could not be completed.',
      data: {
        paymentId: payment._id.toString(),
        kind: payment.kind,
        amount: payment.totalAmount ?? 0,
      },
    });

    return { payment: mapPayment(payment), alreadyFailed: false };
  }

  async list(employer: AuthenticatedEmployer, query: PaymentQuery) {
    const filter: Record<string, unknown> = {
      companyId: new mongoose.Types.ObjectId(employer.companyId),
    };
    if (query.status) filter.status = query.status;
    if (query.kind) filter.kind = query.kind;

    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      Payment.countDocuments(filter),
      Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    ]);

    return {
      payments: rows.map((row) => mapPayment(row)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getById(employer: AuthenticatedEmployer, id: string) {
    const payment = await Payment.findOne({
      _id: id,
      companyId: employer.companyId,
    });
    if (!payment) {
      throw new AppError('Payment not found', HTTP_STATUS.NOT_FOUND);
    }
    let invoice = null;
    if (payment.invoiceId) {
      const inv = await Invoice.findById(payment.invoiceId);
      if (inv) invoice = mapInvoice(inv);
    }
    return { payment: mapPayment(payment), invoice };
  }

  async adminRefund(id: string, input: PaymentRefundInput) {
    const payment = await Payment.findById(id);
    if (!payment) {
      throw new AppError('Payment not found', HTTP_STATUS.NOT_FOUND);
    }
    if (payment.status !== 'succeeded' && payment.status !== 'partially_refunded') {
      throw new AppError(
        'Only succeeded payments can be refunded',
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const already = payment.refundedAmount ?? 0;
    const maxRefundable = Math.max(0, (payment.totalAmount ?? 0) - already);
    if (maxRefundable <= 0) {
      throw new AppError('Payment is already fully refunded', HTTP_STATUS.BAD_REQUEST);
    }

    const refundAmount =
      input.amount === undefined ? maxRefundable : Math.round(input.amount);
    if (refundAmount <= 0 || refundAmount > maxRefundable) {
      throw new AppError('Invalid refund amount', HTTP_STATUS.BAD_REQUEST, [
        {
          path: 'amount',
          message: `Refundable amount is up to ${maxRefundable}`,
        },
      ]);
    }

    if (
      payment.paymentProvider === 'razorpay' &&
      (payment.externalPaymentId ?? '').startsWith('pay_')
    ) {
      await refundRazorpayPayment({
        razorpayPaymentId: payment.externalPaymentId ?? '',
        amountPaise: Math.round(refundAmount * 100),
      });
    }

    payment.refundedAmount = already + refundAmount;
    payment.refundReason = input.reason;
    payment.refundedAt = new Date();
    const fullyRefunded = payment.refundedAmount >= (payment.totalAmount ?? 0);
    payment.status = fullyRefunded ? 'refunded' : 'partially_refunded';

    if (payment.kind === 'credits' && fullyRefunded && (payment.credits ?? 0) > 0) {
      const wallet = await walletService.getWallet(payment.companyId.toString());
      const clawback = Math.min(payment.credits ?? 0, wallet.wallet.balance);
      if (clawback > 0) {
        await walletService.debit({
          companyId: payment.companyId.toString(),
          credits: clawback,
          type: 'refund',
          description: `Refund clawback for payment ${payment._id.toString()}`,
          metadata: { paymentId: payment._id.toString(), refundAmount },
        });
      }
    }

    if (payment.invoiceId) {
      await Invoice.updateOne(
        { _id: payment.invoiceId },
        { $set: { status: fullyRefunded ? 'refunded' : 'issued' } },
      );
    }

    await payment.save();

    await notifySafely({
      recipientId: payment.userId.toString(),
      type: 'PAYMENT_REFUND',
      title: fullyRefunded ? 'Payment refunded' : 'Partial refund issued',
      message: `₹${refundAmount} has been refunded${input.reason ? `: ${input.reason}` : '.'}`,
      data: {
        paymentId: payment._id.toString(),
        refundAmount,
        fullyRefunded,
      },
    });

    return {
      payment: mapPayment(payment),
      refundedNow: refundAmount,
      fullyRefunded,
    };
  }

  /**
   * Admin payment ledger + filters (sheet 413).
   */
  async adminList(query: PaymentQuery & { from?: string; to?: string; companyId?: string }) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.kind) filter.kind = query.kind;
    if (query.companyId) {
      if (!mongoose.Types.ObjectId.isValid(query.companyId)) {
        throw new AppError('Invalid companyId', HTTP_STATUS.BAD_REQUEST, [
          { path: 'companyId', message: 'Invalid id format' },
        ]);
      }
      filter.companyId = new mongoose.Types.ObjectId(query.companyId);
    }
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) (filter.createdAt as Record<string, Date>).$gte = new Date(query.from);
      if (query.to) (filter.createdAt as Record<string, Date>).$lte = new Date(query.to);
    }

    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      Payment.countDocuments(filter),
      Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    ]);

    return {
      payments: rows.map((row) => mapPayment(row)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  /**
   * Revenue / payment summary for admin (sheet 413).
   */
  async adminRevenueSummary(query: { from?: string; to?: string } = {}) {
    const match: Record<string, unknown> = {};
    if (query.from || query.to) {
      match.createdAt = {};
      if (query.from) (match.createdAt as Record<string, Date>).$gte = new Date(query.from);
      if (query.to) (match.createdAt as Record<string, Date>).$lte = new Date(query.to);
    }

    const [byStatus, byKind, totals, creditSpend] = await Promise.all([
      Payment.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { ...match, status: { $in: ['succeeded', 'partially_refunded'] } } },
        {
          $group: {
            _id: '$kind',
            count: { $sum: 1 },
            gross: { $sum: '$totalAmount' },
            refunded: { $sum: '$refundedAmount' },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { ...match, status: { $in: ['succeeded', 'partially_refunded'] } } },
        {
          $group: {
            _id: null,
            grossRevenue: { $sum: '$totalAmount' },
            taxCollected: { $sum: '$taxAmount' },
            refundedTotal: { $sum: '$refundedAmount' },
            paymentCount: { $sum: 1 },
          },
        },
      ]),
      WalletTransaction.aggregate([
        {
          $match: {
            ...match,
            type: { $in: ['spend_boost', 'spend_featured', 'spend_unlock'] },
          },
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            creditsSpent: { $sum: { $abs: '$amount' } },
          },
        },
      ]),
    ]);

    const summary = totals[0] ?? {
      grossRevenue: 0,
      taxCollected: 0,
      refundedTotal: 0,
      paymentCount: 0,
    };

    return {
      currency: 'INR',
      grossRevenue: summary.grossRevenue ?? 0,
      netRevenue: Math.max(0, (summary.grossRevenue ?? 0) - (summary.refundedTotal ?? 0)),
      taxCollected: summary.taxCollected ?? 0,
      refundedTotal: summary.refundedTotal ?? 0,
      paymentCount: summary.paymentCount ?? 0,
      byStatus: byStatus.map((row) => ({
        status: row._id as string,
        count: row.count as number,
        totalAmount: row.totalAmount as number,
      })),
      byKind: byKind.map((row) => ({
        kind: row._id as string,
        count: row.count as number,
        gross: row.gross as number,
        refunded: row.refunded as number,
        net: Math.max(0, (row.gross as number) - (row.refunded as number)),
      })),
      /** Credit wallet spend (boost / featured / unlock) — sheet 438. */
      byCreditSpend: creditSpend.map((row) => ({
        type: row._id as string,
        count: row.count as number,
        creditsSpent: row.creditsSpent as number,
      })),
    };
  }

  async gatewayCheckoutHtml(paymentId: string, token: string): Promise<string> {
    if (!mongoose.Types.ObjectId.isValid(paymentId) || !verifyCheckoutToken(token, paymentId)) {
      throw new AppError('Checkout link is invalid or expired', HTTP_STATUS.UNAUTHORIZED);
    }
    const payment = await Payment.findById(paymentId);
    if (!payment || payment.paymentProvider !== 'razorpay') {
      throw new AppError('Payment not found', HTTP_STATUS.NOT_FOUND);
    }
    if (payment.status === 'succeeded') {
      return '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><p>This payment is already complete. Return to the app.</p>';
    }
    const orderId = String(
      (payment.metadata as { gatewayOrderId?: string } | undefined)?.gatewayOrderId ?? '',
    );
    if (!orderId || !env.razorpayKeyId) {
      throw new AppError('Payment order is not ready', HTTP_STATUS.BAD_REQUEST);
    }
    const amountPaise = Math.round((payment.totalAmount ?? 0) * 100);
    const callbackUrl = `${env.apiPrefix}/payments/gateway/callback`;
    const checkoutDescription = payment.description || `${env.appName} payment`;
    return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pay ${env.appName}</title></head>
<body style="font-family:sans-serif;padding:24px">
<p id="status">Opening secure checkout…</p>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
const statusEl = document.getElementById('status');
const options = {
  key: ${JSON.stringify(env.razorpayKeyId)},
  amount: ${amountPaise},
  currency: "INR",
  name: ${JSON.stringify(env.appName)},
  description: ${JSON.stringify(checkoutDescription)},
  order_id: ${JSON.stringify(orderId)},
  handler: async function (response) {
    statusEl.textContent = 'Confirming payment…';
    try {
      const res = await fetch(${JSON.stringify(callbackUrl)}, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: ${JSON.stringify(payment._id.toString())},
          token: ${JSON.stringify(token)},
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature
        })
      });
      statusEl.textContent = res.ok
        ? 'Payment successful. You can return to the app.'
        : 'Payment could not be confirmed. Return to the app and try again.';
    } catch (err) {
      statusEl.textContent = 'Network error while confirming. Return to the app.';
    }
  },
  modal: { ondismiss: function () { statusEl.textContent = 'Payment cancelled. Return to the app.'; } }
};
new Razorpay(options).open();
</script>
</body></html>`;
  }

  async completeGatewayCallback(input: {
    paymentId: string;
    token: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    if (!verifyCheckoutToken(input.token, input.paymentId)) {
      throw new AppError('Checkout link is invalid or expired', HTTP_STATUS.UNAUTHORIZED);
    }
    const payment = await Payment.findById(input.paymentId);
    if (!payment) {
      throw new AppError('Payment not found', HTTP_STATUS.NOT_FOUND);
    }
    if (payment.status === 'succeeded') {
      return this.buildConfirmResponse(payment);
    }
    const orderId =
      input.razorpayOrderId ||
      String((payment.metadata as { gatewayOrderId?: string } | undefined)?.gatewayOrderId ?? '');
    if (
      !verifyRazorpayPaymentSignature({
        orderId,
        paymentId: input.razorpayPaymentId,
        signature: input.razorpaySignature,
      })
    ) {
      throw new AppError('Payment signature is invalid', HTTP_STATUS.BAD_REQUEST);
    }
    return this.capturePayment(payment, input.razorpayPaymentId);
  }

  async handleRazorpayWebhook(rawBody: Buffer, signature: string) {
    if (!verifyRazorpayWebhook(rawBody, signature)) {
      throw new AppError('Invalid webhook signature', HTTP_STATUS.BAD_REQUEST);
    }
    const event = JSON.parse(rawBody.toString('utf8')) as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            status?: string;
            error_description?: string;
            notes?: { paymentId?: string };
          };
        };
      };
    };
    const entity = event.payload?.payment?.entity;
    const paymentId = entity?.notes?.paymentId ?? '';
    if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
      return { ignored: true };
    }
    const payment = await Payment.findById(paymentId);
    if (!payment) return { ignored: true };

    if (event.event === 'payment.captured' || entity?.status === 'captured') {
      if (payment.status === 'succeeded') return { ignored: false, alreadyConfirmed: true };
      if (entity?.id) {
        await this.capturePayment(payment, entity.id);
      }
      return { ignored: false };
    }

    if (event.event === 'payment.failed' && payment.status === 'pending') {
      payment.status = 'failed';
      payment.failureReason = entity?.error_description || 'Payment failed';
      payment.failedAt = new Date();
      if (entity?.id) payment.externalPaymentId = entity.id;
      await payment.save();
      await notifySafely({
        recipientId: payment.userId.toString(),
        type: 'PAYMENT_FAILED',
        title: 'Payment failed',
        message: payment.failureReason || 'Your payment could not be completed.',
        data: { paymentId: payment._id.toString(), kind: payment.kind },
      });
    }
    return { ignored: false };
  }
}

export const paymentService = new PaymentService();
