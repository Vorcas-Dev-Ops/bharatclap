import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPaymentDLQ extends Document {
  payment_id?: Types.ObjectId;
  order_id?: Types.ObjectId;
  booking_id?: Types.ObjectId;
  user_id?: Types.ObjectId;
  retry_count: number;
  max_retries: number;
  last_error?: string;
  status: 'pending_review' | 'resolved' | 'abandoned';
  payload: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const paymentDLQSchema = new Schema<IPaymentDLQ>(
  {
    payment_id: { type: Schema.Types.ObjectId, ref: 'Payment', index: true },
    order_id: { type: Schema.Types.ObjectId, index: true },
    booking_id: { type: Schema.Types.ObjectId, index: true },
    user_id: { type: Schema.Types.ObjectId, index: true },
    retry_count: { type: Number, default: 0 },
    max_retries: { type: Number, default: 5 },
    last_error: { type: String },
    status: { type: String, enum: ['pending_review', 'resolved', 'abandoned'], default: 'pending_review' },
    payload: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

paymentDLQSchema.index({ status: 1, createdAt: -1 });

export const PaymentDLQ = mongoose.model<IPaymentDLQ>('PaymentDLQ', paymentDLQSchema);
