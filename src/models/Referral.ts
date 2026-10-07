import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const referralCodeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    role: { type: String, enum: ['candidate', 'employer'], required: true },
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
  },
  { timestamps: true, collection: 'referral_codes' },
);

const pointWalletSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    role: { type: String, enum: ['candidate', 'employer'], required: true },
    balance: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true, collection: 'point_wallets' },
);

const referralCreditSchema = new Schema(
  {
    referrerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referredUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    referrerRole: { type: String, enum: ['candidate', 'employer'], required: true },
    referredRole: { type: String, enum: ['candidate', 'employer'], required: true },
    code: { type: String, required: true, lowercase: true, trim: true },
    points: { type: Number, required: true, min: 0 },
  },
  { timestamps: true, collection: 'referral_credits' },
);

export type IReferralCode = InferSchemaType<typeof referralCodeSchema>;
export type ReferralCodeModel = Model<IReferralCode>;
export const ReferralCode: ReferralCodeModel =
  (models.ReferralCode as ReferralCodeModel) ||
  model<IReferralCode>('ReferralCode', referralCodeSchema);

export type IPointWallet = InferSchemaType<typeof pointWalletSchema>;
export type PointWalletModel = Model<IPointWallet>;
export const PointWallet: PointWalletModel =
  (models.PointWallet as PointWalletModel) || model<IPointWallet>('PointWallet', pointWalletSchema);

export type IReferralCredit = InferSchemaType<typeof referralCreditSchema>;
export type ReferralCreditModel = Model<IReferralCredit>;
export const ReferralCredit: ReferralCreditModel =
  (models.ReferralCredit as ReferralCreditModel) ||
  model<IReferralCredit>('ReferralCredit', referralCreditSchema);
