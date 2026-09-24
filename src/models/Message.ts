import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

export const MESSAGE_TYPES = [
  'text',
  'file',
  'resume_share',
  'system',
  'interview_note',
] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    senderRole: {
      type: String,
      enum: ['candidate', 'employer', 'system'],
      required: true,
    },
    type: {
      type: String,
      enum: MESSAGE_TYPES,
      default: 'text',
    },
    body: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: '',
    },
    /** Private media ref `media:<id>` for file/resume shares. */
    mediaRef: {
      type: String,
      trim: true,
      maxlength: 120,
      default: null,
    },
    fileName: {
      type: String,
      trim: true,
      maxlength: 255,
      default: '',
    },
    mimeType: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    /** User ids who have read this message. */
    readBy: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      default: [],
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'messages',
  },
);

messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, senderId: 1, createdAt: -1 });

export type IMessage = InferSchemaType<typeof messageSchema>;
export type MessageModel = Model<IMessage>;

export const Message: MessageModel =
  (models.Message as MessageModel) || model<IMessage>('Message', messageSchema);
