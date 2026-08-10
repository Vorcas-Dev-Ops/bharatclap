import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMessage extends Document {
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'customer' | 'provider' | 'admin';
  text: string;
  media?: {
    type: 'image' | 'pdf' | 'voice' | 'location' | 'booking_photo' | 'completion_photo';
    url: string;
    name?: string;
    size?: string;
    duration?: string;
    latLng?: { lat: number; lng: number; address: string };
  };
  is_intervention: boolean;
  is_deleted: boolean;
  status: 'sent' | 'delivered' | 'read';
  moderation_flag?: {
    reason: string;
    riskScore: number;
  };
  idempotency_key?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema: Schema = new Schema(
  {
    conversation_id: { type: String, required: true, index: true },
    sender_id: { type: String, required: true, index: true },
    sender_name: { type: String, required: true },
    sender_role: {
      type: String,
      enum: ['customer', 'provider', 'admin'],
      required: true,
    },
    text: { type: String, default: '' },
    media: {
      type: { type: String },
      url: { type: String },
      name: { type: String },
      size: { type: String },
      duration: { type: String },
      latLng: {
        lat: { type: Number },
        lng: { type: Number },
        address: { type: String },
      },
    },
    is_intervention: { type: Boolean, default: false },
    is_deleted: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'delivered',
    },
    moderation_flag: {
      reason: { type: String },
      riskScore: { type: Number },
    },
    idempotency_key: { type: String, index: true },
  },
  { timestamps: true }
);

ChatMessageSchema.index({ conversation_id: 1, createdAt: 1 });

export const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);
