import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

/**
 * Metered contact unlock ledger (sheet 242).
 * One unlock per company↔candidate; credits deducted on first unlock.
 */
const contactUnlockSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    employerId: {
      type: Schema.Types.ObjectId,
      ref: 'Employer',
      required: true,
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true,
    },
    creditsSpent: {
      type: Number,
      min: 0,
      default: 1,
    },
    unlockedAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    timestamps: true,
    collection: 'contact_unlocks',
  },
);

contactUnlockSchema.index({ companyId: 1, candidateId: 1 }, { unique: true });
contactUnlockSchema.index({ companyId: 1, unlockedAt: -1 });

export type IContactUnlock = InferSchemaType<typeof contactUnlockSchema>;
export type ContactUnlockModel = Model<IContactUnlock>;

export const ContactUnlock: ContactUnlockModel =
  (models.ContactUnlock as ContactUnlockModel) ||
  model<IContactUnlock>('ContactUnlock', contactUnlockSchema);
