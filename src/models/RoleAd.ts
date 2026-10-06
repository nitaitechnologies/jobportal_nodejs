import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { ENTITY_STATUSES, ROLE_AD_TYPES } from '../constants/enums';

/**
 * Paid ads sold against roles-master categories.
 * Shown to candidates when AI flags that role/skill as a gap.
 */
const roleAdSchema = new Schema(
  {
    companyName: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, default: '', maxlength: 2000 },
    bannerUrl: { type: String, required: true, trim: true, maxlength: 1000 },
    mobileBannerUrl: { type: String, trim: true, default: '', maxlength: 1000 },
    linkUrl: { type: String, required: true, trim: true, maxlength: 1000 },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ROLE_AD_TYPES, required: true },
    categoryIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
      required: true,
      validate: {
        validator(value: unknown[]) {
          return Array.isArray(value) && value.length > 0;
        },
        message: 'Select at least one role category',
      },
    },
    status: { type: String, enum: ENTITY_STATUSES, default: 'inactive' },
    clickCount: { type: Number, default: 0, min: 0 },
    uniqueUserCount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    collection: 'role_ads',
  },
);

roleAdSchema.index({ status: 1, fromDate: 1, toDate: 1 });
roleAdSchema.index({ categoryIds: 1, status: 1 });
roleAdSchema.index({ companyName: 1 });

export type IRoleAd = InferSchemaType<typeof roleAdSchema>;
export type RoleAdModel = Model<IRoleAd>;

export const RoleAd: RoleAdModel =
  (models.RoleAd as RoleAdModel) || model<IRoleAd>('RoleAd', roleAdSchema);
