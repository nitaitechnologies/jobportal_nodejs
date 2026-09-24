import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

/**
 * Auth session for logout + device restriction (sheet 163–164).
 * JWT `jti` maps to this document's `_id`.
 */
const authSessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['candidate', 'employer', 'admin'],
      required: true,
    },
    deviceLabel: { type: String, trim: true, default: '', maxlength: 160 },
    userAgent: { type: String, trim: true, default: '', maxlength: 400 },
    ip: { type: String, trim: true, default: '', maxlength: 80 },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    lastSeenAt: { type: Date, default: () => new Date() },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'auth_sessions',
  },
);

authSessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type IAuthSession = InferSchemaType<typeof authSessionSchema>;
export type AuthSessionModel = Model<IAuthSession>;

export const AuthSession: AuthSessionModel =
  (models.AuthSession as AuthSessionModel) ||
  model<IAuthSession>('AuthSession', authSessionSchema);
