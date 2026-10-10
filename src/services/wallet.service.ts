import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import type { PackageWalletBucket, WalletTxnType } from '../constants/enums';
import { CompanyWallet, WalletTransaction } from '../models/CompanyWallet';
import { AppError } from '../utils/AppError';

const BUCKET_LABEL: Record<PackageWalletBucket, string> = {
  jobPosts: 'job post',
  boosts: 'boost',
  unlocks: 'database unlock',
  createdPoints: 'created point',
};

export async function getOrCreateWallet(companyId: string) {
  const existing = await CompanyWallet.findOne({ companyId });
  if (existing) return existing;
  return CompanyWallet.create({
    companyId: new mongoose.Types.ObjectId(companyId),
    balance: 0,
  });
}

export class WalletService {
  async getWallet(companyId: string) {
    const wallet = await getOrCreateWallet(companyId);
    return {
      wallet: {
        companyId: wallet.companyId.toString(),
        balance: wallet.balance ?? 0,
        jobPosts: wallet.jobPosts ?? 0,
        boosts: wallet.boosts ?? 0,
        unlocks: wallet.unlocks ?? 0,
        createdPoints: wallet.createdPoints ?? 0,
        updatedAt: wallet.updatedAt ?? null,
      },
    };
  }

  async listTransactions(
    companyId: string,
    query: { page: number; limit: number },
  ) {
    const filter = { companyId: new mongoose.Types.ObjectId(companyId) };
    const skip = (query.page - 1) * query.limit;
    const [total, rows] = await Promise.all([
      WalletTransaction.countDocuments(filter),
      WalletTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    ]);

    return {
      transactions: rows.map((row) => ({
        id: row._id.toString(),
        type: row.type,
        bucket: row.bucket || 'legacy',
        amount: row.amount,
        balanceAfter: row.balanceAfter,
        paymentId: row.paymentId?.toString() ?? null,
        description: row.description ?? '',
        createdAt: row.createdAt ?? null,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async credit(input: {
    companyId: string;
    credits: number;
    type: WalletTxnType;
    paymentId?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (input.credits <= 0) {
      throw new AppError('Credit amount must be positive', HTTP_STATUS.BAD_REQUEST);
    }
    const wallet = await getOrCreateWallet(input.companyId);
    wallet.balance = (wallet.balance ?? 0) + input.credits;
    await wallet.save();

    await WalletTransaction.create({
      companyId: wallet.companyId,
      type: input.type,
      amount: input.credits,
      balanceAfter: wallet.balance,
      paymentId: input.paymentId
        ? new mongoose.Types.ObjectId(input.paymentId)
        : null,
      description: input.description ?? '',
      metadata: input.metadata ?? {},
    });

    return wallet.balance;
  }

  async debit(input: {
    companyId: string;
    credits: number;
    type: WalletTxnType;
    description?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (input.credits <= 0) {
      throw new AppError('Debit amount must be positive', HTTP_STATUS.BAD_REQUEST);
    }
    const wallet = await getOrCreateWallet(input.companyId);
    const balance = wallet.balance ?? 0;
    if (balance < input.credits) {
      throw new AppError('Insufficient wallet credits', HTTP_STATUS.FORBIDDEN, [
        { path: 'credits', message: `Available balance is ${balance}` },
      ]);
    }
    wallet.balance = balance - input.credits;
    await wallet.save();

    await WalletTransaction.create({
      companyId: wallet.companyId,
      type: input.type,
      amount: -input.credits,
      balanceAfter: wallet.balance,
      description: input.description ?? '',
      metadata: input.metadata ?? {},
    });

    return wallet.balance;
  }

  async creditBucket(input: {
    companyId: string;
    bucket: PackageWalletBucket;
    credits: number;
    type: WalletTxnType;
    paymentId?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (input.credits <= 0) return this.bucketBalance(input.companyId, input.bucket);
    await getOrCreateWallet(input.companyId);
    const wallet = await CompanyWallet.findOneAndUpdate(
      { companyId: new mongoose.Types.ObjectId(input.companyId) },
      { $inc: { [input.bucket]: input.credits } },
      { new: true },
    );
    if (!wallet) {
      throw new AppError('Wallet not found', HTTP_STATUS.NOT_FOUND);
    }
    const balanceAfter = Number(wallet[input.bucket] ?? 0);
    await WalletTransaction.create({
      companyId: wallet.companyId,
      type: input.type,
      bucket: input.bucket,
      amount: input.credits,
      balanceAfter,
      paymentId: input.paymentId ? new mongoose.Types.ObjectId(input.paymentId) : null,
      description: input.description ?? '',
      metadata: input.metadata ?? {},
    });
    return balanceAfter;
  }

  async debitBucket(input: {
    companyId: string;
    bucket: PackageWalletBucket;
    credits: number;
    type: WalletTxnType;
    description?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (input.credits <= 0) {
      throw new AppError('Debit amount must be positive', HTTP_STATUS.BAD_REQUEST);
    }
    if (input.bucket === 'createdPoints') {
      throw new AppError('Created points cannot be spent yet', HTTP_STATUS.BAD_REQUEST);
    }
    await getOrCreateWallet(input.companyId);
    const wallet = await CompanyWallet.findOneAndUpdate(
      {
        companyId: new mongoose.Types.ObjectId(input.companyId),
        [input.bucket]: { $gte: input.credits },
      },
      { $inc: { [input.bucket]: -input.credits } },
      { new: true },
    );
    if (!wallet) {
      const current = await this.bucketBalance(input.companyId, input.bucket);
      throw new AppError(
        `Not enough ${BUCKET_LABEL[input.bucket]} credits`,
        HTTP_STATUS.FORBIDDEN,
        [{ path: input.bucket, message: `Available ${BUCKET_LABEL[input.bucket]} credits: ${current}` }],
      );
    }
    const balanceAfter = Number(wallet[input.bucket] ?? 0);
    await WalletTransaction.create({
      companyId: wallet.companyId,
      type: input.type,
      bucket: input.bucket,
      amount: -input.credits,
      balanceAfter,
      description: input.description ?? '',
      metadata: input.metadata ?? {},
    });
    return balanceAfter;
  }

  async bucketBalance(companyId: string, bucket: PackageWalletBucket) {
    const wallet = await getOrCreateWallet(companyId);
    return Number(wallet[bucket] ?? 0);
  }
}

export const walletService = new WalletService();
