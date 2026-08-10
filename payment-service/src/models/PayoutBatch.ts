import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPayoutBatch extends Document {
  batch_number: string;
  settlement_ids: Array<Types.ObjectId | string>;
  total_amount: number;
  total_settlements: number;
  status: 'created' | 'submitted' | 'processing' | 'completed' | 'failed';
  bank_file_url?: string;
  requires_approval: boolean;
  is_approved: boolean;
  approved_by?: string;
  approved_at?: Date;
  processed_at?: Date;
  createdAt: Date;
}

const payoutBatchSchema = new Schema<IPayoutBatch>(
  {
    batch_number: { type: String, required: true, unique: true, index: true },
    settlement_ids: [{ type: Schema.Types.Mixed, required: true }],
    total_amount: { type: Number, required: true, min: 0 },
    total_settlements: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ['created', 'submitted', 'processing', 'completed', 'failed'],
      default: 'created',
    },
    bank_file_url: { type: String },
    requires_approval: { type: Boolean, default: false },
    is_approved: { type: Boolean, default: false },
    approved_by: { type: String },
    approved_at: { type: Date },
    processed_at: { type: Date },
  },
  {
    timestamps: true,
  }
);

payoutBatchSchema.index({ createdAt: -1 });

export const PayoutBatch = mongoose.model<IPayoutBatch>('PayoutBatch', payoutBatchSchema);
