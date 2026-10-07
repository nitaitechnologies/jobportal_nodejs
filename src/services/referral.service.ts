import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import { PointWallet, ReferralCode, ReferralCredit } from '../models/Referral';
import { User } from '../models/User';
import type { AuthenticatedAdmin } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { ensureDefaultSettings, settingsService } from './settings.service';

const POINTS_KEY = 'referral.pointsPerSignup';
const DEFAULT_POINTS = 50;
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export type ReferralRole = 'candidate' | 'employer';

function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: number }).code === 11000,
  );
}

function randomCode(length = 8): string {
  const bytes = randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return code;
}

function normalizeCode(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

async function pointsPerSignup(): Promise<number> {
  const value = await settingsService.getNumber(POINTS_KEY, DEFAULT_POINTS);
  if (!Number.isFinite(value)) return DEFAULT_POINTS;
  return Math.min(100000, Math.max(0, Math.floor(value)));
}

export class ReferralService {
  async ensureCode(userId: mongoose.Types.ObjectId | string, role: ReferralRole) {
    const existing = await ReferralCode.findOne({ userId });
    if (existing) return existing;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        return await ReferralCode.create({
          userId,
          role,
          code: randomCode(),
        });
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        const raced = await ReferralCode.findOne({ userId });
        if (raced) return raced;
      }
    }

    throw new AppError('Could not create a referral code', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }

  async getMine(userId: string, role: ReferralRole) {
    const codeDoc = await this.ensureCode(userId, role);
    const [wallet, credits, reward] = await Promise.all([
      PointWallet.findOne({ userId }).select('balance'),
      ReferralCredit.find({ referrerUserId: userId }).sort({ createdAt: -1 }).limit(30).lean(),
      pointsPerSignup(),
    ]);

    const referredIds = credits.map((row) => row.referredUserId);
    const people = referredIds.length
      ? await User.find({ _id: { $in: referredIds } }).select('name role').lean()
      : [];
    const byId = new Map(people.map((person) => [String(person._id), person]));

    return {
      code: codeDoc.code,
      sharePath: `/r/${codeDoc.code}`,
      balance: wallet?.balance ?? 0,
      pointsPerSignup: reward,
      referrals: credits.map((row) => {
        const person = byId.get(String(row.referredUserId));
        return {
          id: String(row._id),
          name: person?.name?.trim() || 'New member',
          role: row.referredRole,
          points: row.points,
          createdAt: row.createdAt,
        };
      }),
    };
  }

  /**
   * Credit the referrer once when a brand-new candidate or employer registers.
   * Invalid codes, self-referral, and inactive referrers are ignored.
   * Registration itself must not fail if this step does.
   */
  async creditOnSignup(input: {
    newUserId: mongoose.Types.ObjectId;
    newUserRole: ReferralRole;
    referralCode?: string;
  }): Promise<{ awarded: boolean; points: number }> {
    const code = normalizeCode(input.referralCode);
    if (!code || !/^[a-z0-9]{4,16}$/.test(code)) {
      return { awarded: false, points: 0 };
    }

    const referral = await ReferralCode.findOne({ code });
    if (!referral) return { awarded: false, points: 0 };
    if (String(referral.userId) === String(input.newUserId)) {
      return { awarded: false, points: 0 };
    }

    const referrer = await User.findById(referral.userId).select('status deletedAt role');
    if (!referrer || referrer.deletedAt || referrer.status !== 'active') {
      return { awarded: false, points: 0 };
    }
    if (referrer.role !== 'candidate' && referrer.role !== 'employer') {
      return { awarded: false, points: 0 };
    }

    const already = await ReferralCredit.findOne({ referredUserId: input.newUserId }).select('_id');
    if (already) return { awarded: false, points: 0 };

    const points = await pointsPerSignup();

    try {
      await ReferralCredit.create({
        referrerUserId: referral.userId,
        referredUserId: input.newUserId,
        referrerRole: referrer.role,
        referredRole: input.newUserRole,
        code,
        points,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) return { awarded: false, points: 0 };
      throw error;
    }

    try {
      await PointWallet.findOneAndUpdate(
        { userId: referral.userId },
        {
          $inc: { balance: points },
          $setOnInsert: { role: referrer.role },
        },
        { upsert: true },
      );
    } catch (error) {
      await ReferralCredit.deleteOne({ referredUserId: input.newUserId }).catch(() => undefined);
      throw error;
    }

    return { awarded: true, points };
  }

  async adminOverview() {
    const [reward, credits, walletAgg] = await Promise.all([
      pointsPerSignup(),
      ReferralCredit.find().sort({ createdAt: -1 }).limit(40).lean(),
      PointWallet.aggregate<{ balance: number; wallets: number }>([
        { $group: { _id: null, balance: { $sum: '$balance' }, wallets: { $sum: 1 } } },
      ]),
    ]);

    const userIds = [
      ...new Set(credits.flatMap((row) => [String(row.referrerUserId), String(row.referredUserId)])),
    ];
    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } }).select('name email role').lean()
      : [];
    const byId = new Map(users.map((user) => [String(user._id), user]));

    const totals = walletAgg[0] ?? { balance: 0, wallets: 0 };

    return {
      pointsPerSignup: reward,
      totals: {
        wallets: totals.wallets,
        pointsInWallets: totals.balance,
        referrals: await ReferralCredit.countDocuments(),
      },
      referrals: credits.map((row) => {
        const referrer = byId.get(String(row.referrerUserId));
        const referred = byId.get(String(row.referredUserId));
        return {
          id: String(row._id),
          points: row.points,
          createdAt: row.createdAt,
          referrer: {
            name: referrer?.name ?? 'Unknown',
            email: referrer?.email ?? '',
            role: row.referrerRole,
          },
          referred: {
            name: referred?.name ?? 'Unknown',
            email: referred?.email ?? '',
            role: row.referredRole,
          },
        };
      }),
    };
  }

  async setPointsPerSignup(admin: AuthenticatedAdmin, points: number) {
    await ensureDefaultSettings();
    const updated = await settingsService.update(admin, POINTS_KEY, { value: points });
    const value = updated.setting.value;
    return { pointsPerSignup: typeof value === 'number' ? value : points };
  }
}

export const referralService = new ReferralService();
