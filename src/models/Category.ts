import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { ENTITY_STATUSES } from '../constants/enums';
import { slugify } from '../utils/slug';

const categorySchema = new Schema(
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
    description: { type: String, trim: true, default: '', maxlength: 2000 },
    icon: { type: String, trim: true, default: '' },
    image: { type: String, trim: true, default: '' },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    status: {
      type: String,
      enum: ENTITY_STATUSES,
      default: 'active',
    },
    sortOrder: { type: Number, default: 0 },
    jobCount: { type: Number, min: 0, default: 0 },
  },
  {
    timestamps: true,
    collection: 'categories',
  },
);

categorySchema.pre('validate', function preValidate() {
  if (this.name && !this.slug) {
    this.slug = slugify(this.name);
  }
});

categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ parentId: 1, sortOrder: 1 });
categorySchema.index({ status: 1, sortOrder: 1 });
categorySchema.index({ name: 1 });

export type ICategory = InferSchemaType<typeof categorySchema>;
export type CategoryModel = Model<ICategory>;

export const Category: CategoryModel =
  (models.Category as CategoryModel) || model<ICategory>('Category', categorySchema);
