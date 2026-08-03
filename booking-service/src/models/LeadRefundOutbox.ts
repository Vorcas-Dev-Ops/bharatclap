import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILeadRefundOutbox extends Document {
  booking_id: Types.ObjectId | string;
  provider_id: Types.ObjectId | string;
  booking_stage: string;
  cancelled_by: 'customer' | 'provider' | 'admin';
  status: 'PENDING' | 'SENT' | 'CONFIRMED' | 'FAILED';
  correlation_id?: string;
  idempotency_key: string;
  attempts: number;
  last_attempted_at?: Date;
  error_message?: string;
  createdAt: Date;
  updatedAt: Date;
}

const leadRefundOutboxSchema = new Schema<ILeadRefundOutbox>(
  {
    booking_id: { type: Schema.Types.Mixed, required: true, index: true },
    provider_id: { type: Schema.Types.Mixed, required: true, index: true },
    booking_stage: { type: String, required: true },
    cancelled_by: { type: String, enum: ['customer', 'provider', 'admin'], required: true },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'CONFIRMED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    correlation_id: { type: String },
    idempotency_key: { type: String, required: true, unique: true, index: true },
    attempts: { type: Number, default: 0 },
    last_attempted_at: { type: Date },
    error_message: { type: String },
  },
  { timestamps: true }
);

leadRefundOutboxSchema.index({ status: 1, attempts: 1 });

export const LeadRefundOutbox = mongoose.model<ILeadRefundOutbox>('LeadRefundOutbox', leadRefundOutboxSchema);
