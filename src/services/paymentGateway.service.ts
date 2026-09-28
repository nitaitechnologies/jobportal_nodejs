import crypto from 'crypto';
import { HTTP_STATUS } from '../constants';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

const RAZORPAY_API = 'https://api.razorpay.com/v1';

export function razorpayConfigured(): boolean {
  return Boolean(env.razorpayKeyId && env.razorpayKeySecret);
}

function basicAuth(): string {
  return Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString('base64');
}

function timingEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function signCheckoutToken(paymentId: string, ttlMs = 30 * 60 * 1000): string {
  const exp = Date.now() + ttlMs;
  const payload = `${paymentId}.${exp}`;
  const sig = crypto.createHmac('sha256', env.jwtSecret).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export function verifyCheckoutToken(token: string, paymentId: string): boolean {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const parts = raw.split('.');
    if (parts.length !== 3) return false;
    const [id, expStr, sig] = parts;
    if (id !== paymentId || !sig) return false;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp < Date.now()) return false;
    const expected = crypto
      .createHmac('sha256', env.jwtSecret)
      .update(`${id}.${expStr}`)
      .digest('hex');
    return timingEqual(sig, expected);
  } catch {
    return false;
  }
}

export function verifyRazorpayPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!env.razorpayKeySecret) return false;
  const expected = crypto
    .createHmac('sha256', env.razorpayKeySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest('hex');
  return timingEqual(input.signature, expected);
}

export function verifyRazorpayWebhook(rawBody: Buffer, signature: string): boolean {
  if (!env.razorpayWebhookSecret || !signature) return false;
  const expected = crypto
    .createHmac('sha256', env.razorpayWebhookSecret)
    .update(rawBody)
    .digest('hex');
  return timingEqual(signature, expected);
}

export async function createRazorpayOrder(input: {
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<{ orderId: string; amountPaise: number; currency: 'INR'; keyId: string }> {
  if (!razorpayConfigured()) {
    throw new AppError('Payment gateway is not configured', HTTP_STATUS.SERVICE_UNAVAILABLE);
  }
  if (input.amountPaise < 100) {
    throw new AppError('Gateway amount must be at least ₹1', HTTP_STATUS.BAD_REQUEST);
  }

  const response = await fetch(`${RAZORPAY_API}/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: 'INR',
      receipt: input.receipt.slice(0, 40),
      notes: input.notes,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    error?: { description?: string };
  };
  if (!response.ok || !body.id) {
    throw new AppError(
      body.error?.description || 'Could not create payment order',
      HTTP_STATUS.SERVICE_UNAVAILABLE,
    );
  }

  return {
    orderId: body.id,
    amountPaise: input.amountPaise,
    currency: 'INR',
    keyId: env.razorpayKeyId,
  };
}

export async function refundRazorpayPayment(input: {
  razorpayPaymentId: string;
  amountPaise: number;
}): Promise<void> {
  if (!razorpayConfigured()) {
    throw new AppError('Payment gateway is not configured', HTTP_STATUS.SERVICE_UNAVAILABLE);
  }
  const response = await fetch(`${RAZORPAY_API}/payments/${input.razorpayPaymentId}/refund`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount: input.amountPaise }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: { description?: string };
    };
    throw new AppError(
      body.error?.description || 'Gateway refund failed',
      HTTP_STATUS.SERVICE_UNAVAILABLE,
    );
  }
}
