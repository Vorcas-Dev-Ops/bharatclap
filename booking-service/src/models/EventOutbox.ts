import mongoose, { Document, Schema } from 'mongoose';

export interface IEventOutbox extends Document {
  event_id: string; // Deterministic business ID (e.g. "booking.created:{bookingId}")
  event_type: string;
  payload: string; // JSON payload
  status: 'PENDING' | 'PROCESSING' | 'PUBLISHED' | 'DLQ';
  attempts: number;
  last_attempted_at?: Date;
  lease_expires_at?: Date;
  lease_owner?: string;
  error_message?: string;
  createdAt: Date;
  updatedAt: Date;
}

const eventOutboxSchema = new Schema<IEventOutbox>(
  {
    event_id: { type: String, required: true, unique: true, index: true },
    event_type: { type: String, required: true, index: true },
    payload: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'PUBLISHED', 'DLQ'],
      default: 'PENDING',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    last_attempted_at: { type: Date },
    lease_expires_at: { type: Date },
    lease_owner: { type: String },
    error_message: { type: String },
  },
  { timestamps: true }
);

eventOutboxSchema.index({ status: 1, attempts: 1 });

export const EventOutbox = mongoose.model<IEventOutbox>('EventOutbox', eventOutboxSchema);
