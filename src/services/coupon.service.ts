import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import { Coupon } from '../models/Coupon';
import { SubscriptionPlan } from '../models/SubscriptionPlan';
import { AppError } from '../utils/AppError';
import type {
  CouponCreateInput,
  CouponPreviewInput,
  CouponQuery,
  CouponUpdateInput,
} from '../validators/coupon.validator';

export type CouponPricing = {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  currency: string;
};

function mapCoupon(doc: {
  _id: { toString(): string };
  code: string;
  description?: string | null;
  type: string;
  value: number;
  currency?: string | null;
  applicablePlanIds?: Array<{ toString(): string }>;
  minAmount?: number | null;
  maxRedemptions?: number | null;
  redeemedCount?: number | null;
  validFrom?: Date | null;
  validTo?: Date | null;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: doc._id.toString(),
    code: doc.code,
    description: doc.description ?? '',
    type: doc.type,
    value: doc.value,
    currency: doc.currency ?? 'INR',
    applicablePlanIds: (doc.applicablePlanIds ?? []).map((id) => id.toString()),
    minAmount: doc.minAmount ?? 0,
    maxRedemptions: doc.maxRedemptions ?? 0,
    redeemedCount: doc.redeemedCount ?? 0,
    validFrom: doc.validFrom ?? null,
    validTo: doc.validTo ?? null,
    status: doc.status ?? 'active',
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}

function computeDiscount(listPrice: number, type: 'percent' | 'fixed', value: number): number {
  if (listPrice <= 0) return 0;
  if (type === 'percent') {
    return Math.min(listPrice, Math.round((listPrice * value) / 100));
  }
  return Math.min(listPrice, Math.round(value));
}

/**
 * Resolve a live coupon against a plan price. Does not increment redemption.
 */
export async function resolveCouponPricing(
  code: string,
  planId: string,
  opts: { consume?: boolean } = {},
): Promise<CouponPricing> {
  const plan = await SubscriptionPlan.findById(planId);
  if (!plan || plan.status !== 'active') {
    throw new AppError('Subscription plan not found', HTTP_STATUS.NOT_FOUND);
  }

  const coupon = await Coupon.findOne({ code: code.trim().toUpperCase() });
  if (!coupon) {
    throw new AppError('Coupon not found', HTTP_STATUS.NOT_FOUND, [
      { path: 'code', message: 'Invalid or unknown coupon code' },
    ]);
  }
  if (coupon.status !== 'active') {
    throw new AppError('Coupon is inactive', HTTP_STATUS.BAD_REQUEST, [
      { path: 'code', message: 'This coupon is no longer active' },
    ]);
  }

  const now = new Date();
  if (coupon.validFrom && coupon.validFrom > now) {
    throw new AppError('Coupon is not yet valid', HTTP_STATUS.BAD_REQUEST, [
      { path: 'code', message: 'This coupon is not active yet' },
    ]);
  }
  if (coupon.validTo && coupon.validTo < now) {
    throw new AppError('Coupon has expired', HTTP_STATUS.BAD_REQUEST, [
      { path: 'code', message: 'This coupon has expired' },
    ]);
  }

  const max = coupon.maxRedemptions ?? 0;
  const used = coupon.redeemedCount ?? 0;
  if (max > 0 && used >= max) {
    throw new AppError('Coupon redemption limit reached', HTTP_STATUS.BAD_REQUEST, [
      { path: 'code', message: 'This coupon has been fully redeemed' },
    ]);
  }

  const allowed = coupon.applicablePlanIds ?? [];
  if (allowed.length > 0 && !allowed.some((id) => id.toString() === planId)) {
    throw new AppError('Coupon not valid for this plan', HTTP_STATUS.BAD_REQUEST, [
      { path: 'code', message: 'This coupon does not apply to the selected plan' },
    ]);
  }

  const originalAmount = plan.price ?? 0;
  const minAmount = coupon.minAmount ?? 0;
  if (originalAmount < minAmount) {
    throw new AppError('Plan price below coupon minimum', HTTP_STATUS.BAD_REQUEST, [
      {
        path: 'code',
        message: `This coupon requires a plan of at least ${minAmount}`,
      },
    ]);
  }

  const type = coupon.type as 'percent' | 'fixed';
  const discountAmount = computeDiscount(originalAmount, type, coupon.value);
  const finalAmount = Math.max(0, originalAmount - discountAmount);

  if (opts.consume) {
    coupon.redeemedCount = used + 1;
    await coupon.save();
  }

  return {
    code: coupon.code,
    type,
    value: coupon.value,
    originalAmount,
    discountAmount,
    finalAmount,
    currency: plan.currency ?? 'INR',
  };
}

export class CouponService {
  async create(input: CouponCreateInput) {
    const existing = await Coupon.findOne({ code: input.code });
    if (existing) {
      throw new AppError('Coupon code already exists', HTTP_STATUS.CONFLICT, [
        { path: 'code', message: 'Choose a different code' },
      ]);
    }

    const coupon = await Coupon.create({
      ...input,
      applicablePlanIds: input.applicablePlanIds.map((id) => new mongoose.Types.ObjectId(id)),
      redeemedCount: 0,
    });
    return { coupon: mapCoupon(coupon) };
  }

  async list(query: CouponQuery) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.q) {
      filter.$or = [
        { code: { $regex: query.q, $options: 'i' } },
        { description: { $regex: query.q, $options: 'i' } },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      Coupon.countDocuments(filter),
      Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    ]);

    return {
      coupons: rows.map((row) => mapCoupon(row)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getById(id: string) {
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      throw new AppError('Coupon not found', HTTP_STATUS.NOT_FOUND);
    }
    return { coupon: mapCoupon(coupon) };
  }

  async update(id: string, input: CouponUpdateInput) {
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      throw new AppError('Coupon not found', HTTP_STATUS.NOT_FOUND);
    }

    if (input.description !== undefined) coupon.description = input.description;
    if (input.type !== undefined) coupon.type = input.type;
    if (input.value !== undefined) coupon.value = input.value;
    if (input.currency !== undefined) coupon.currency = input.currency;
    if (input.applicablePlanIds !== undefined) {
      coupon.applicablePlanIds = input.applicablePlanIds.map(
        (pid) => new mongoose.Types.ObjectId(pid),
      ) as never;
    }
    if (input.minAmount !== undefined) coupon.minAmount = input.minAmount;
    if (input.maxRedemptions !== undefined) coupon.maxRedemptions = input.maxRedemptions;
    if (input.validFrom !== undefined) coupon.validFrom = input.validFrom;
    if (input.validTo !== undefined) coupon.validTo = input.validTo;
    if (input.status !== undefined) coupon.status = input.status;

    if (coupon.type === 'percent' && coupon.value > 100) {
      throw new AppError('Percent coupons cannot exceed 100', HTTP_STATUS.BAD_REQUEST);
    }

    await coupon.save();
    return { coupon: mapCoupon(coupon) };
  }

  async deactivate(id: string) {
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      throw new AppError('Coupon not found', HTTP_STATUS.NOT_FOUND);
    }
    coupon.status = 'inactive';
    await coupon.save();
    return { coupon: mapCoupon(coupon) };
  }

  async preview(input: CouponPreviewInput) {
    const pricing = await resolveCouponPricing(input.code, input.planId);
    return { pricing };
  }
}

export const couponService = new CouponService();
