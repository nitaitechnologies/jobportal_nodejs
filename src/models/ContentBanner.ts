import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { ENTITY_STATUSES } from '../constants/enums';

/**
 * Homepage / marketing banners (sheet 419).
 * Additive content CMS — does not affect existing pages until FE consumes them.
 */
const contentBannerSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    subtitle: { type: String, trim: true, default: '', maxlength: 300 },
    imageUrl: { type: String, trim: true, default: '', maxlength: 1000 },
    linkUrl: { type: String, trim: true, default: '', maxlength: 1000 },
    ctaLabel: { type: String, trim: true, default: '', maxlength: 60 },
    placement: {
      type: String,
      enum: ['homepage_hero', 'homepage_secondary', 'jobs_top'],
      default: 'homepage_hero',
    },
    status: {
      type: String,
      enum: ENTITY_STATUSES,
      default: 'inactive',
    },
    sortOrder: { type: Number, default: 0 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'content_banners',
  },
);

contentBannerSchema.index({ status: 1, placement: 1, sortOrder: 1 });

export type IContentBanner = InferSchemaType<typeof contentBannerSchema>;
export type ContentBannerModel = Model<IContentBanner>;

export const ContentBanner: ContentBannerModel =
  (models.ContentBanner as ContentBannerModel) ||
  model<IContentBanner>('ContentBanner', contentBannerSchema);
