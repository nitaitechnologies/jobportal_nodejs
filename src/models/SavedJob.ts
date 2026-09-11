import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const savedJobSchema = new Schema(
  {
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'saved_jobs',
  },
);

savedJobSchema.index({ candidateId: 1, jobId: 1 }, { unique: true });
savedJobSchema.index({ candidateId: 1, createdAt: -1 });
savedJobSchema.index({ jobId: 1 });

export type ISavedJob = InferSchemaType<typeof savedJobSchema>;
export type SavedJobModel = Model<ISavedJob>;

export const SavedJob: SavedJobModel =
  (models.SavedJob as SavedJobModel) || model<ISavedJob>('SavedJob', savedJobSchema);
