import mongoose, { Schema, Document } from 'mongoose';

export type RefundStatus =
  | 'REQUESTED'
  | 'VALIDATING'
  | 'APPROVED'
  | 'PROCESSING'
  | 'PENDING_GATEWAY'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRYING'
  | 'MANUAL_REVIEW';

export interface IRefund extends Document {
  bookingId: mongoose.Types.ObjectId;
  paymentId?: string;
  razorpayPaymentId?: string;
  customerId: mongoose.Types.ObjectId;
  providerId?: mongoose.Types.ObjectId;
  refundAmount: number;
  refundType: 'FULL' | 'PARTIAL';
  refundSpeed?: 'optimum' | 'instant' | 'normal';
  reason: string;
  status: RefundStatus;
  gatewayRefundId?: string;
  idempotencyKey: string;
  requestedAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  payoutAttempts: number;
  maxPayoutAttempts: number;
  metadata?: any;
}

const RefundSchema: Schema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, required: true, index: true },
    paymentId: { type: String },
    razorpayPaymentId: { type: String, index: true },
    customerId: { type: Schema.Types.ObjectId, required: true },
    providerId: { type: Schema.Types.ObjectId },
    refundAmount: { type: Number, required: true },
    refundType: { type: String, enum: ['FULL', 'PARTIAL'], default: 'FULL' },
    refundSpeed: { type: String, enum: ['optimum', 'instant', 'normal'], default: 'optimum' },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: [
        'REQUESTED',
        'VALIDATING',
        'APPROVED',
        'PROCESSING',
        'PENDING_GATEWAY',
        'COMPLETED',
        'FAILED',
        'RETRYING',
        'MANUAL_REVIEW',
      ],
      default: 'REQUESTED',
      index: true,
    },
    gatewayRefundId: { type: String, index: true },
    idempotencyKey: { type: String, required: true, index: true },
    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
    completedAt: { type: Date },
    failedAt: { type: Date },
    failureReason: { type: String },
    payoutAttempts: { type: Number, default: 0 },
    maxPayoutAttempts: { type: Number, default: 3 },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    optimisticConcurrency: true // Enable optimistic concurrency control (__v)
  }
);

RefundSchema.index({ bookingId: 1, idempotencyKey: 1 }, { unique: true });
RefundSchema.index({ status: 1, createdAt: -1 });

export const Refund = mongoose.model<IRefund>('Refund', RefundSchema);
