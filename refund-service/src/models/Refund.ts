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
  customerId: mongoose.Types.ObjectId;
  providerId?: mongoose.Types.ObjectId;
  refundAmount: number;
  refundType: 'FULL' | 'PARTIAL';
  reason: string;
  status: RefundStatus;
  gatewayRefundId?: string;
  idempotencyKey: string;
  requestedAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  metadata?: any;
}

const RefundSchema: Schema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, required: true, index: true },
    paymentId: { type: String },
    customerId: { type: Schema.Types.ObjectId, required: true },
    providerId: { type: Schema.Types.ObjectId },
    refundAmount: { type: Number, required: true },
    refundType: { type: String, enum: ['FULL', 'PARTIAL'], default: 'FULL' },
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
    gatewayRefundId: { type: String },
    idempotencyKey: { type: String, required: true, index: true },
    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
    completedAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

RefundSchema.index({ bookingId: 1, idempotencyKey: 1 }, { unique: true });

export const Refund = mongoose.model<IRefund>('Refund', RefundSchema);
