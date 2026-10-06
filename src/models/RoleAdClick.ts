import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

/** One row per candidate per ad. clickCount is that user's total clicks. */
const roleAdClickSchema = new Schema(
  {
    adId: { type: Schema.Types.ObjectId, ref: 'RoleAd', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    userName: { type: String, trim: true, default: '', maxlength: 120 },
    userEmail: { type: String, trim: true, default: '', maxlength: 255 },
    clickCount: { type: Number, default: 0, min: 0 },
    firstClickedAt: { type: Date, required: true },
    lastClickedAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    collection: 'role_ad_clicks',
  },
);

roleAdClickSchema.index({ adId: 1, userId: 1 }, { unique: true });
roleAdClickSchema.index({ adId: 1, clickCount: -1, lastClickedAt: -1 });

export type IRoleAdClick = InferSchemaType<typeof roleAdClickSchema>;
export type RoleAdClickModel = Model<IRoleAdClick>;

export const RoleAdClick: RoleAdClickModel =
  (models.RoleAdClick as RoleAdClickModel) ||
  model<IRoleAdClick>('RoleAdClick', roleAdClickSchema);
