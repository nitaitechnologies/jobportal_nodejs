import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import {
  ANALYTICS_ACTOR_ROLES,
  ANALYTICS_ENTITY_TYPES,
  ANALYTICS_EVENT_TYPES,
} from '../constants/enums';

/**
 * Historical event-level analytics (B3 + B21).
 * Operational counters (Job.views, applicationsCount, etc.) remain separate.
 */
const analyticsEventSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    actorRole: {
      type: String,
      enum: ANALYTICS_ACTOR_ROLES,
      default: 'anonymous',
    },
    eventType: {
      type: String,
      enum: ANALYTICS_EVENT_TYPES,
      required: true,
    },
    entityType: {
      type: String,
      enum: ANALYTICS_ENTITY_TYPES,
      trim: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
    },
    jobId: { type: Schema.Types.ObjectId, ref: 'Job' },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
    employerId: { type: Schema.Types.ObjectId, ref: 'Employer' },
    candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate' },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location' },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    sessionId: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    ipHash: {
      type: String,
      trim: true,
      default: '',
      maxlength: 128,
    },
    userAgent: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'analytics_events',
  },
);

analyticsEventSchema.index({ eventType: 1, occurredAt: -1 });
analyticsEventSchema.index({ eventType: 1, createdAt: -1 });
analyticsEventSchema.index({ userId: 1, occurredAt: -1 });
analyticsEventSchema.index({ actorRole: 1, occurredAt: -1 });
analyticsEventSchema.index({ entityType: 1, entityId: 1, occurredAt: -1 });
analyticsEventSchema.index({ jobId: 1, eventType: 1, occurredAt: -1 });
analyticsEventSchema.index({ companyId: 1, eventType: 1, occurredAt: -1 });
analyticsEventSchema.index({ employerId: 1, eventType: 1, occurredAt: -1 });
analyticsEventSchema.index({ candidateId: 1, eventType: 1, occurredAt: -1 });
analyticsEventSchema.index({ categoryId: 1, eventType: 1, occurredAt: -1 });
analyticsEventSchema.index({ locationId: 1, eventType: 1, occurredAt: -1 });
analyticsEventSchema.index({ sessionId: 1, occurredAt: -1 });
analyticsEventSchema.index({ occurredAt: -1 });
analyticsEventSchema.index({ createdAt: -1 });

export type IAnalyticsEvent = InferSchemaType<typeof analyticsEventSchema>;
export type AnalyticsEventModel = Model<IAnalyticsEvent>;

export const AnalyticsEvent: AnalyticsEventModel =
  (models.AnalyticsEvent as AnalyticsEventModel) ||
  model<IAnalyticsEvent>('AnalyticsEvent', analyticsEventSchema);
