import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

/**
 * Append-only admin audit trail (B22).
 * Distinct from AnalyticsEvent (B21 product analytics).
 */
const adminAuditLogSchema = new Schema(
  {
    adminUserId: {
      type: Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: true,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    entityType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    entityId: {
      type: Schema.Types.ObjectId,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'admin_audit_logs',
  },
);

adminAuditLogSchema.index({ createdAt: -1 });
adminAuditLogSchema.index({ adminUserId: 1, createdAt: -1 });
adminAuditLogSchema.index({ action: 1, createdAt: -1 });
adminAuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export type IAdminAuditLog = InferSchemaType<typeof adminAuditLogSchema>;
export type AdminAuditLogModel = Model<IAdminAuditLog>;

export const AdminAuditLog: AdminAuditLogModel =
  (models.AdminAuditLog as AdminAuditLogModel) ||
  model<IAdminAuditLog>('AdminAuditLog', adminAuditLogSchema);
