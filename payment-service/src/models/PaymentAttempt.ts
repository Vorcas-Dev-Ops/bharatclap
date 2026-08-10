import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPaymentAttempt extends Document {
  payment_id?: Types.ObjectId | string;
  booking_id?: Types.ObjectId | string;
  attempt_no: number;
  gateway: string;
  request_payload?: Record<string, any>;
  response_payload?: Record<string, any>;
  gateway_payment_id?: string;
  status: 'initiated' | 'authorized' | 'captured' | 'failed' | 'cancelled';
  failure_reason?: string;
  initiated_at: Date;
  completed_at?: Date;
  createdAt: Date;
}

const paymentAttemptSchema = new Schema<IPaymentAttempt>(
  {
    payment_id: { type: Schema.Types.Mixed, index: true },
    booking_id: { type: Schema.Types.Mixed, index: true },
    attempt_no: { type: Number, required: true, default: 1 },
    gateway: { type: String, default: 'razorpay' },
    request_payload: { type: Schema.Types.Mixed },
    response_payload: { type: Schema.Types.Mixed },
    gateway_payment_id: { type: String, trim: true, index: true },
    status: {
      type: String,
      enum: ['initiated', 'authorized', 'captured', 'failed', 'cancelled'],
      default: 'initiated',
    },
    failure_reason: { type: String },
    initiated_at: { type: Date, default: Date.now },
    completed_at: { type: Date },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable attempt records!
  }
);

paymentAttemptSchema.index({ booking_id: 1, attempt_no: 1 });

export const PaymentAttempt = mongoose.model<IPaymentAttempt>('PaymentAttempt', paymentAttemptSchema);
