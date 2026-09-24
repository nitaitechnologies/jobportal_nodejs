import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const userBlockSchema = new Schema(
  {
    blockerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    blockedId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'user_blocks',
  },
);

userBlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

export type IUserBlock = InferSchemaType<typeof userBlockSchema>;
export type UserBlockModel = Model<IUserBlock>;

export const UserBlock: UserBlockModel =
  (models.UserBlock as UserBlockModel) || model<IUserBlock>('UserBlock', userBlockSchema);
