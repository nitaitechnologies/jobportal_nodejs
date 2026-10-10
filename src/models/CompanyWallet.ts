import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { WALLET_TXN_TYPES } from '../constants/enums';

/**
 * Company wallet balance for purchasable credits (sheet 351–357, 360).
 */
const companyWalletSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      unique: true,
    },
    balance: { type: Number, min: 0, default: 0 },
    /** City-package / custom-proposal credits. createdPoints is reserved and not spent yet. */
    jobPosts: { type: Number, min: 0, default: 0 },
    boosts: { type: Number, min: 0, default: 0 },
    unlocks: { type: Number, min: 0, default: 0 },
    createdPoints: { type: Number, min: 0, default: 0 },
  },
  {
    timestamps: true,
    collection: 'company_wallets',
  },
);

const walletTransactionSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    type: { type: String, enum: WALLET_TXN_TYPES, required: true },
    /** Positive = credit, negative = debit. */
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, min: 0, required: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
    description: { type: String, trim: true, default: '', maxlength: 300 },
    /** `legacy` is the old single credit balance. Package buckets use their own name. */
    bucket: { type: String, trim: true, default: 'legacy', maxlength: 40 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: 'wallet_transactions',
  },
);

walletTransactionSchema.index({ companyId: 1, createdAt: -1 });

export type ICompanyWallet = InferSchemaType<typeof companyWalletSchema>;
export type CompanyWalletModel = Model<ICompanyWallet>;
export type IWalletTransaction = InferSchemaType<typeof walletTransactionSchema>;
export type WalletTransactionModel = Model<IWalletTransaction>;

export const CompanyWallet: CompanyWalletModel =
  (models.CompanyWallet as CompanyWalletModel) ||
  model<ICompanyWallet>('CompanyWallet', companyWalletSchema);

export const WalletTransaction: WalletTransactionModel =
  (models.WalletTransaction as WalletTransactionModel) ||
  model<IWalletTransaction>('WalletTransaction', walletTransactionSchema);
