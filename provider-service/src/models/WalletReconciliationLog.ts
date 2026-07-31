import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IWalletReconciliationLog extends Document {
  provider_id: Types.ObjectId;
  expected_balance: number;
  actual_balance: number;
  difference: number;
  status: 'MATCH' | 'CORRECTED' | 'FAILED';
  reconciled_at: Date;
  job_id: string;
  details?: any;
  createdAt: Date;
  updatedAt: Date;
}

const walletReconciliationLogSchema = new Schema<IWalletReconciliationLog>(
  {
    provider_id: { type: Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    expected_balance: { type: Number, required: true },
    actual_balance: { type: Number, required: true },
    difference: { type: Number, required: true },
    status: {
      type: String,
      enum: ['MATCH', 'CORRECTED', 'FAILED'],
      required: true,
      default: 'MATCH',
      index: true
    },
    reconciled_at: { type: Date, default: Date.now, required: true },
    job_id: { type: String, required: true, index: true },
    details: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

export const WalletReconciliationLog = mongoose.model<IWalletReconciliationLog>(
  'WalletReconciliationLog',
  walletReconciliationLogSchema
);
