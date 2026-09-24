import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const talentPoolFolderSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    employerId: {
      type: Schema.Types.ObjectId,
      ref: 'Employer',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'talent_pool_folders',
  },
);

talentPoolFolderSchema.index({ companyId: 1, name: 1 }, { unique: true });
talentPoolFolderSchema.index({ companyId: 1, createdAt: -1 });

export type ITalentPoolFolder = InferSchemaType<typeof talentPoolFolderSchema>;
export type TalentPoolFolderModel = Model<ITalentPoolFolder>;

export const TalentPoolFolder: TalentPoolFolderModel =
  (models.TalentPoolFolder as TalentPoolFolderModel) ||
  model<ITalentPoolFolder>('TalentPoolFolder', talentPoolFolderSchema);
