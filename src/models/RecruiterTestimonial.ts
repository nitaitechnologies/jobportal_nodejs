import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { ENTITY_STATUSES } from '../constants/enums';

/**
 * Homepage "Our Happy Recruiters" testimonials.
 * Public list only returns active rows, ordered by sortOrder.
 */
const recruiterTestimonialSchema = new Schema(
  {
    recruiterName: { type: String, required: true, trim: true, maxlength: 120 },
    companyName: { type: String, required: true, trim: true, maxlength: 160 },
    roleTitle: { type: String, trim: true, default: '', maxlength: 120 },
    quote: { type: String, required: true, trim: true, maxlength: 2000 },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    avatarUrl: { type: String, trim: true, default: '', maxlength: 1000 },
    status: {
      type: String,
      enum: ENTITY_STATUSES,
      default: 'inactive',
    },
    sortOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'recruiter_testimonials',
  },
);

recruiterTestimonialSchema.index({ status: 1, sortOrder: 1 });

export type IRecruiterTestimonial = InferSchemaType<typeof recruiterTestimonialSchema>;
export type RecruiterTestimonialModel = Model<IRecruiterTestimonial>;

export const RecruiterTestimonial: RecruiterTestimonialModel =
  (models.RecruiterTestimonial as RecruiterTestimonialModel) ||
  model<IRecruiterTestimonial>('RecruiterTestimonial', recruiterTestimonialSchema);
