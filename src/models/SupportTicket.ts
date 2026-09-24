import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import {
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_STATUSES,
} from '../constants/enums';

/**
 * Support tickets — raise ticket + technical issue reporting (sheet 374, 377).
 * Distinct from safety Reports (fraud/scam targeting jobs/users).
 */
const supportTicketSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    role: {
      type: String,
      enum: ['candidate', 'employer', 'guest', 'admin'],
      default: 'guest',
    },
    name: { type: String, trim: true, required: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, required: true, maxlength: 200 },
    subject: { type: String, trim: true, required: true, maxlength: 200 },
    category: {
      type: String,
      enum: SUPPORT_TICKET_CATEGORIES,
      required: true,
    },
    message: { type: String, trim: true, required: true, maxlength: 5000 },
    status: {
      type: String,
      enum: SUPPORT_TICKET_STATUSES,
      default: 'open',
    },
    /** Optional platform report linkage for technical_issue category. */
    reportId: {
      type: Schema.Types.ObjectId,
      ref: 'Report',
      default: null,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    resolution: { type: String, trim: true, default: '', maxlength: 5000 },
    resolvedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'support_tickets',
  },
);

supportTicketSchema.index({ status: 1, createdAt: -1 });
supportTicketSchema.index({ email: 1, createdAt: -1 });
supportTicketSchema.index({ userId: 1, createdAt: -1 });
supportTicketSchema.index({ category: 1, status: 1 });

export type ISupportTicket = InferSchemaType<typeof supportTicketSchema>;
export type SupportTicketModel = Model<ISupportTicket>;

export const SupportTicket: SupportTicketModel =
  (models.SupportTicket as SupportTicketModel) ||
  model<ISupportTicket>('SupportTicket', supportTicketSchema);
