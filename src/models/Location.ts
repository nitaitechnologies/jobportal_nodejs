import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { ENTITY_STATUSES, LOCATION_TYPES } from '../constants/enums';
import { slugify } from '../utils/slug';

const locationSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 140,
    },
    type: {
      type: String,
      enum: LOCATION_TYPES,
      required: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
    countryCode: { type: String, trim: true, uppercase: true, maxlength: 3, default: '' },
    stateCode: { type: String, trim: true, uppercase: true, maxlength: 10, default: '' },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    status: {
      type: String,
      enum: ENTITY_STATUSES,
      default: 'active',
    },
  },
  {
    timestamps: true,
    collection: 'locations',
  },
);

locationSchema.pre('validate', function preValidate() {
  if (this.name && !this.slug) {
    this.slug = slugify(this.name);
  }
});

locationSchema.index({ slug: 1 }, { unique: true });
locationSchema.index({ parentId: 1, name: 1 }, { unique: true });
locationSchema.index({ parentId: 1, type: 1, status: 1 });
locationSchema.index({ type: 1, status: 1 });
locationSchema.index({ countryCode: 1, stateCode: 1 });
locationSchema.index({ name: 1, type: 1 });

export type ILocation = InferSchemaType<typeof locationSchema>;
export type LocationModel = Model<ILocation>;

export const Location: LocationModel =
  (models.Location as LocationModel) || model<ILocation>('Location', locationSchema);
