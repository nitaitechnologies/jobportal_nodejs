import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { ENTITY_STATUSES } from '../constants/enums';
import { slugify } from '../utils/slug';

/** FAQ / help articles (sheet 422). */
const faqItemSchema = new Schema(
  {
    question: { type: String, required: true, trim: true, maxlength: 300 },
    answer: { type: String, required: true, trim: true, maxlength: 10000 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    category: {
      type: String,
      enum: ['general', 'candidate', 'employer', 'payments', 'safety'],
      default: 'general',
    },
    status: {
      type: String,
      enum: ENTITY_STATUSES,
      default: 'inactive',
    },
    sortOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'faq_items',
  },
);

faqItemSchema.pre('validate', function preValidate() {
  if (this.question && !this.slug) {
    this.slug = slugify(this.question).slice(0, 160);
  }
});

faqItemSchema.index({ slug: 1 }, { unique: true });
faqItemSchema.index({ status: 1, category: 1, sortOrder: 1 });

export type IFaqItem = InferSchemaType<typeof faqItemSchema>;
export type FaqItemModel = Model<IFaqItem>;

export const FaqItem: FaqItemModel =
  (models.FaqItem as FaqItemModel) || model<IFaqItem>('FaqItem', faqItemSchema);
