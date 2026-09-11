import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { ARTICLE_STATUSES } from '../constants/enums';
import { slugify } from '../utils/slug';

const careerArticleSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 220,
    },
    excerpt: { type: String, trim: true, default: '', maxlength: 500 },
    content: { type: String, required: true, trim: true },
    featuredImage: { type: String, trim: true, default: '' },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: { type: String, trim: true, default: '' },
    tags: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    status: {
      type: String,
      enum: ARTICLE_STATUSES,
      default: 'draft',
    },
    publishedAt: { type: Date },
    views: { type: Number, min: 0, default: 0 },
    seoTitle: { type: String, trim: true, default: '', maxlength: 70 },
    seoDescription: { type: String, trim: true, default: '', maxlength: 160 },
  },
  {
    timestamps: true,
    collection: 'career_articles',
  },
);

careerArticleSchema.pre('validate', function preValidate() {
  if (this.title && !this.slug) {
    this.slug = slugify(this.title);
  }
});

careerArticleSchema.index({ slug: 1 }, { unique: true });
careerArticleSchema.index({ status: 1, publishedAt: -1 });
careerArticleSchema.index({ authorId: 1 });
careerArticleSchema.index({ tags: 1 });
careerArticleSchema.index({ category: 1, status: 1 });
careerArticleSchema.index({ status: 1, views: -1 });
careerArticleSchema.index(
  { title: 'text', excerpt: 'text', content: 'text', tags: 'text' },
  {
    name: 'career_article_text_search',
    weights: { title: 10, excerpt: 5, tags: 4, content: 1 },
  },
);

export type ICareerArticle = InferSchemaType<typeof careerArticleSchema>;
export type CareerArticleModel = Model<ICareerArticle>;

export const CareerArticle: CareerArticleModel =
  (models.CareerArticle as CareerArticleModel) ||
  model<ICareerArticle>('CareerArticle', careerArticleSchema);
