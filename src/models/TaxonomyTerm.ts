import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { ENTITY_STATUSES } from '../constants/enums';
import { slugify } from '../utils/slug';

/** Admin content taxonomies (sheet 415–417) — separate from job Category to avoid UI/API breakage. */
export const TAXONOMY_KINDS = ['skill', 'industry', 'education'] as const;
export type TaxonomyKind = (typeof TAXONOMY_KINDS)[number];

const taxonomyTermSchema = new Schema(
  {
    kind: {
      type: String,
      enum: TAXONOMY_KINDS,
      required: true,
      index: true,
    },
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
    status: {
      type: String,
      enum: ENTITY_STATUSES,
      default: 'active',
    },
    sortOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'taxonomy_terms',
  },
);

taxonomyTermSchema.pre('validate', function preValidate() {
  if (this.name && !this.slug) {
    this.slug = slugify(this.name);
  }
});

taxonomyTermSchema.index({ kind: 1, slug: 1 }, { unique: true });
taxonomyTermSchema.index({ kind: 1, status: 1, sortOrder: 1 });
taxonomyTermSchema.index({ kind: 1, name: 1 });

export type ITaxonomyTerm = InferSchemaType<typeof taxonomyTermSchema>;
export type TaxonomyTermModel = Model<ITaxonomyTerm>;

export const TaxonomyTerm: TaxonomyTermModel =
  (models.TaxonomyTerm as TaxonomyTermModel) ||
  model<ITaxonomyTerm>('TaxonomyTerm', taxonomyTermSchema);
