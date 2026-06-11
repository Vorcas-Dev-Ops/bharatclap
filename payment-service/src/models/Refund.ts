import mongoose, { Schema, Document } from 'mongoose';

export interface IRefund extends Document {
  payment_id: mongoose.Types.ObjectId;
  booking_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  reason?: string;
  gateway_refund_id?: string;
  createdAt: Date;
  updatedAt: Date;
}

const refundSchema = new Schema<IRefund>(
  {
    payment_id: { type: Schema.Types.ObjectId, ref: 'Payment', required: true },
    booking_id: { type: Schema.Types.ObjectId, required: true },
    user_id: { type: Schema.Types.ObjectId, required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    reason: { type: String },
    gateway_refund_id: { type: String },
  },
  { timestamps: true }
);

export const Refund = mongoose.model<IRefund>('Refund', refundSchema);
