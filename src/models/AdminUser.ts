import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { ACCOUNT_STATUSES, ADMIN_ROLES } from '../constants/enums';

const adminUserSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ADMIN_ROLES,
      required: true,
      default: 'admin',
    },
    permissions: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    status: {
      type: String,
      enum: ACCOUNT_STATUSES,
      default: 'active',
    },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'admin_users',
  },
);

adminUserSchema.index({ userId: 1 }, { unique: true });
adminUserSchema.index({ role: 1, status: 1 });

export type IAdminUser = InferSchemaType<typeof adminUserSchema>;
export type AdminUserModel = Model<IAdminUser>;

export const AdminUser: AdminUserModel =
  (models.AdminUser as AdminUserModel) || model<IAdminUser>('AdminUser', adminUserSchema);
