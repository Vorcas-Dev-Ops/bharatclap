import mongoose, { Schema, Document } from 'mongoose';

export interface IOutboxEvent extends Document {
  eventType: string;
  payload: any;
  status: 'PENDING' | 'PUBLISHED' | 'FAILED';
  retryCount: number;
  error?: string;
  createdAt: Date;
}

const OutboxEventSchema: Schema = new Schema(
  {
    eventType: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ['PENDING', 'PUBLISHED', 'FAILED'], default: 'PENDING', index: true },
    retryCount: { type: Number, default: 0 },
    error: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const OutboxEvent = mongoose.model<IOutboxEvent>('OutboxEvent', OutboxEventSchema);
