import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { ENTITY_STATUSES } from '../constants/enums';

/**
 * Homepage "Our Happy Job Seekers" testimonials.
 * Public list only returns active rows, ordered by sortOrder.
 */
const jobSeekerTestimonialSchema = new Schema(
  {
    seekerName: { type: String, required: true, trim: true, maxlength: 120 },
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
    collection: 'job_seeker_testimonials',
  },
);

jobSeekerTestimonialSchema.index({ status: 1, sortOrder: 1 });

export type IJobSeekerTestimonial = InferSchemaType<typeof jobSeekerTestimonialSchema>;
export type JobSeekerTestimonialModel = Model<IJobSeekerTestimonial>;

export const JobSeekerTestimonial: JobSeekerTestimonialModel =
  (models.JobSeekerTestimonial as JobSeekerTestimonialModel) ||
  model<IJobSeekerTestimonial>('JobSeekerTestimonial', jobSeekerTestimonialSchema);
