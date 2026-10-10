import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const grantsSchema = new Schema(
  {
    jobPosts: { type: Number, min: 0, max: 100_000, default: 0 },
    boosts: { type: Number, min: 0, max: 100_000, default: 0 },
    unlocks: { type: Number, min: 0, max: 1_000_000, default: 0 },
    /** Reserved. Granted on payment, not spent by any feature yet. */
    createdPoints: { type: Number, min: 0, max: 1_000_000, default: 0 },
  },
  { _id: false },
);

const cityPackageSchema = new Schema(
  {
    city: { type: String, required: true, trim: true, maxlength: 80 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, default: '', maxlength: 500 },
    price: { type: Number, min: 0, required: true },
    durationDays: { type: Number, min: 1, max: 366, default: 30 },
    sortOrder: { type: Number, min: 1, max: 4, default: 1 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    grants: { type: grantsSchema, default: () => ({}) },
  },
  { timestamps: true, collection: 'city_packages' },
);

cityPackageSchema.index({ city: 1, status: 1, sortOrder: 1 });
cityPackageSchema.index({ city: 1, name: 1 }, { unique: true });

export type ICityPackage = InferSchemaType<typeof cityPackageSchema>;
export type CityPackageModel = Model<ICityPackage>;

export const CityPackage: CityPackageModel =
  (models.CityPackage as CityPackageModel) || model<ICityPackage>('CityPackage', cityPackageSchema);
