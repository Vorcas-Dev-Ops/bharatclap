import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISettlementOutbox extends Document {
  booking_id: Types.ObjectId;
  provider_id: Types.ObjectId;
  booking_display_id: string;
  payment_type: 'online' | 'cod';
  payable_amount: number;
  commission_percentage: number;
  status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'DLQ';
  attempts: number;
  last_attempted_at?: Date;
  delivered_at?: Date;
  error_message?: string;
  dlq_reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const settlementOutboxSchema = new Schema<ISettlementOutbox>(
  {
    booking_id: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
    provider_id: { type: Schema.Types.ObjectId, required: true, index: true },
    booking_display_id: { type: String, required: true },
    payment_type: { type: String, enum: ['online', 'cod'], required: true },
    payable_amount: { type: Number, required: true },
    commission_percentage: { type: Number, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'DELIVERED', 'FAILED', 'DLQ'],
      default: 'PENDING',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    last_attempted_at: { type: Date },
    delivered_at: { type: Date },
    error_message: { type: String },
    dlq_reason: { type: String },
  },
  { timestamps: true }
);

settlementOutboxSchema.index({ status: 1, attempts: 1 });

export const SettlementOutbox = mongoose.model<ISettlementOutbox>('SettlementOutbox', settlementOutboxSchema);
