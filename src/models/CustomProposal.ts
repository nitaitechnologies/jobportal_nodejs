import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const grantsSchema = new Schema(
  {
    jobPosts: { type: Number, min: 0, max: 100_000, default: 0 },
    boosts: { type: Number, min: 0, max: 100_000, default: 0 },
    unlocks: { type: Number, min: 0, max: 1_000_000, default: 0 },
    createdPoints: { type: Number, min: 0, max: 1_000_000, default: 0 },
  },
  { _id: false },
);

const customProposalSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    city: { type: String, trim: true, default: '', maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    note: { type: String, trim: true, default: '', maxlength: 1000 },
    price: { type: Number, min: 0, required: true },
    durationDays: { type: Number, min: 1, max: 366, default: 30 },
    grants: { type: grantsSchema, default: () => ({}) },
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled'],
      default: 'pending',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'custom_proposals' },
);

customProposalSchema.index({ companyId: 1, status: 1, createdAt: -1 });

export type ICustomProposal = InferSchemaType<typeof customProposalSchema>;
export type CustomProposalModel = Model<ICustomProposal>;

export const CustomProposal: CustomProposalModel =
  (models.CustomProposal as CustomProposalModel) ||
  model<ICustomProposal>('CustomProposal', customProposalSchema);
