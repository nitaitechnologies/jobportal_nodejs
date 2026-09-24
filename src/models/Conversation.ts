import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

export const CONVERSATION_CONTEXTS = ['application', 'interview', 'invitation'] as const;
export type ConversationContext = (typeof CONVERSATION_CONTEXTS)[number];

const conversationSchema = new Schema(
  {
    candidateUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    employerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true,
    },
    employerId: {
      type: Schema.Types.ObjectId,
      ref: 'Employer',
      required: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      unique: true,
    },
    interviewId: {
      type: Schema.Types.ObjectId,
      ref: 'Interview',
      default: null,
    },
    context: {
      type: String,
      enum: CONVERSATION_CONTEXTS,
      default: 'application',
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
    lastMessagePreview: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
    /** Per-user unread counts keyed by userId string. */
    unread: {
      type: Map,
      of: Number,
      default: {},
    },
    /** Per-user last-read message id. */
    lastReadMessageId: {
      type: Map,
      of: Schema.Types.ObjectId,
      default: {},
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'conversations',
  },
);

conversationSchema.index({ candidateUserId: 1, lastMessageAt: -1 });
conversationSchema.index({ employerUserId: 1, lastMessageAt: -1 });
conversationSchema.index({ jobId: 1, candidateUserId: 1 });

export type IConversation = InferSchemaType<typeof conversationSchema>;
export type ConversationModel = Model<IConversation>;

export const Conversation: ConversationModel =
  (models.Conversation as ConversationModel) ||
  model<IConversation>('Conversation', conversationSchema);
