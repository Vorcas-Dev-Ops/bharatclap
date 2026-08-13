import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISettlementPayoutAttempt extends Document {
  settlement_id: Types.ObjectId;
  provider_id: Types.ObjectId;
  idempotency_key: string;
  razorpay_payout_id?: string;
  amount: number;
  gateway_payout_status: string;
  request_reference?: string;
  response_snapshot?: Record<string, any>;
  attempt_number: number;
  failure_reason?: string;
  is_retryable?: boolean;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const settlementPayoutAttemptSchema = new Schema<ISettlementPayoutAttempt>(
  {
    settlement_id: { type: Schema.Types.ObjectId, ref: 'ProviderSettlement', required: true, index: true },
    provider_id: { type: Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    idempotency_key: { type: String, required: true, index: true },
    razorpay_payout_id: { type: String, index: true },
    amount: { type: Number, required: true },
    gateway_payout_status: { type: String, required: true, default: 'processing' },
    request_reference: { type: String },
    response_snapshot: { type: Schema.Types.Mixed },
    attempt_number: { type: Number, required: true, default: 1 },
    failure_reason: { type: String },
    is_retryable: { type: Boolean, default: true },
    processedAt: { type: Date },
  },
  { timestamps: true }
);

settlementPayoutAttemptSchema.index({ settlement_id: 1, attempt_number: 1 });

export const SettlementPayoutAttempt = mongoose.model<ISettlementPayoutAttempt>(
  'SettlementPayoutAttempt',
  settlementPayoutAttemptSchema
);
