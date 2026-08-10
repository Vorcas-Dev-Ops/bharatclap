import mongoose, { Schema, Document } from 'mongoose';

export interface IConversation extends Document {
  conversation_id: string;
  booking_id?: string;
  service_title?: string;
  type: 'booking' | 'customer_support' | 'provider_support';
  customer: {
    id: string;
    name: string;
    phone: string;
    avatar?: string;
    presence?: 'online' | 'offline' | 'busy' | 'on_booking';
  };
  provider?: {
    id: string;
    name: string;
    phone: string;
    avatar?: string;
    serviceCategory?: string;
    presence?: 'online' | 'offline' | 'busy' | 'on_booking';
  };
  status: 'active' | 'resolved' | 'flagged';
  last_message: string;
  last_message_at: Date;
  unread_count_customer: number;
  unread_count_provider: number;
  unread_count_admin: number;
  moderation: {
    isFlagged: boolean;
    riskScore: number;
    flaggedReasons: string[];
    notes: string[];
    reviewedBy?: string;
    reviewedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema: Schema = new Schema(
  {
    conversation_id: { type: String, required: true, unique: true, index: true },
    booking_id: { type: String, index: true },
    service_title: { type: String },
    type: {
      type: String,
      enum: ['booking', 'customer_support', 'provider_support'],
      default: 'booking',
      index: true,
    },
    customer: {
      id: { type: String, required: true, index: true },
      name: { type: String, required: true },
      phone: { type: String, required: true },
      avatar: { type: String },
      presence: { type: String, default: 'online' },
    },
    provider: {
      id: { type: String, index: true },
      name: { type: String },
      phone: { type: String },
      avatar: { type: String },
      serviceCategory: { type: String },
      presence: { type: String, default: 'offline' },
    },
    status: {
      type: String,
      enum: ['active', 'resolved', 'flagged'],
      default: 'active',
      index: true,
    },
    last_message: { type: String, default: '' },
    last_message_at: { type: Date, default: Date.now, index: true },
    unread_count_customer: { type: Number, default: 0 },
    unread_count_provider: { type: Number, default: 0 },
    unread_count_admin: { type: Number, default: 0 },
    moderation: {
      isFlagged: { type: Boolean, default: false, index: true },
      riskScore: { type: Number, default: 0 },
      flaggedReasons: [{ type: String }],
      notes: [{ type: String }],
      reviewedBy: { type: String },
      reviewedAt: { type: Date },
    },
  },
  { timestamps: true }
);

ConversationSchema.index({ customer_id: 1, last_message_at: -1 });
ConversationSchema.index({ provider_id: 1, last_message_at: -1 });

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
