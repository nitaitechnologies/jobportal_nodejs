import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { USER_ROLES, USER_STATUSES } from '../constants/enums';

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 255,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      maxlength: 20,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      required: true,
    },
    avatar: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: USER_STATUSES,
      default: 'active',
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $type: 'string', $gt: '' } },
  },
);
userSchema.index({ role: 1, status: 1 });

export type IUser = InferSchemaType<typeof userSchema>;
export type UserModel = Model<IUser>;

export const User: UserModel = (models.User as UserModel) || model<IUser>('User', userSchema);
