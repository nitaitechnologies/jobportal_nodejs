import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { ACCOUNT_STATUSES } from '../constants/enums';

const employerSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    designation: { type: String, trim: true, default: '', maxlength: 120 },
    department: { type: String, trim: true, default: '', maxlength: 120 },
    verified: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ACCOUNT_STATUSES,
      default: 'active',
    },
  },
  {
    timestamps: true,
    collection: 'employers',
  },
);

employerSchema.index({ userId: 1 }, { unique: true });
employerSchema.index({ companyId: 1 });
employerSchema.index({ status: 1, verified: 1 });

export type IEmployer = InferSchemaType<typeof employerSchema>;
export type EmployerModel = Model<IEmployer>;

export const Employer: EmployerModel =
  (models.Employer as EmployerModel) || model<IEmployer>('Employer', employerSchema);
