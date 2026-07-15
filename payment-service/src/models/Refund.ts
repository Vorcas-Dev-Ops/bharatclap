import mongoose, { Schema, Document } from 'mongoose';

export interface IRefund extends Document {
  payment_id: mongoose.Types.ObjectId;
  booking_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  amount: number;
  status: 'requested' | 'approved' | 'rejected' | 'processed';
  reason?: string;
  refund_reason?: string;
  original_amount?: number;
  processed_by_admin?: string;
  processed_at?: Date;
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
      enum: ['requested', 'approved', 'rejected', 'processed'],
      default: 'requested',
    },
    reason: { type: String },
    refund_reason: { type: String },
    original_amount: { type: Number },
    processed_by_admin: { type: String },
    processed_at: { type: Date },
    gateway_refund_id: { type: String },
  },
  { timestamps: true }
);

refundSchema.index({ payment_id: 1 });
refundSchema.index({ booking_id: 1 });
refundSchema.index({ user_id: 1 });

export const Refund = mongoose.model<IRefund>('Refund', refundSchema);
