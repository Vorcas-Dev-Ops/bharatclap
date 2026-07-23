import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPayment extends Document {
  booking_id?: Types.ObjectId;
  order_id?: Types.ObjectId;
  user_id: Types.ObjectId;
  amount: number;
  payment_method: 'online' | 'cod' | 'UPI' | 'Card' | 'COD' | 'Razorpay';
  payment_provider?: 'razorpay' | string | null;
  payment_channel?: 'upi' | 'card' | 'netbanking' | 'wallet' | string | null;
  payment_status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded';
  payment_link_status?: 'linked' | 'pending' | 'failed';
  transaction_id?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  payment_attempt_id?: string;
  correlation_id?: string;
  failure_reason?: string;
  gateway_response?: Record<string, any>;
  refund_metadata?: {
    refund_id?: string;
    refund_amount?: number;
    refund_reason?: string;
    refunded_at?: Date;
  };
  status_history?: Array<{
    status: string;
    timestamp: Date;
    note?: string;
  }>;
  payment_date?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    booking_id: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    order_id: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    payment_method: {
      type: String,
      required: true,
    },
    payment_provider: {
      type: String,
      default: null,
    },
    payment_channel: {
      type: String,
      default: null,
    },
    payment_status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded'],
      default: 'pending',
      required: true,
    },
    payment_link_status: {
      type: String,
      enum: ['linked', 'pending', 'failed'],
      default: 'pending',
    },
    transaction_id: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    razorpay_order_id: {
      type: String,
      trim: true,
    },
    razorpay_payment_id: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    razorpay_signature: {
      type: String,
      trim: true,
    },
    payment_attempt_id: {
      type: String,
      trim: true,
    },
    correlation_id: {
      type: String,
      trim: true,
    },
    failure_reason: {
      type: String,
    },
    gateway_response: {
      type: Schema.Types.Mixed,
    },
    refund_metadata: {
      refund_id: { type: String },
      refund_amount: { type: Number },
      refund_reason: { type: String },
      refunded_at: { type: Date },
    },
    status_history: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
    payment_date: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ booking_id: 1, payment_status: 1 });
paymentSchema.index({ order_id: 1, payment_status: 1 });
paymentSchema.index({ user_id: 1, createdAt: -1 });

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);

