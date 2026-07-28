import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IWalletTransaction extends Document {
  provider_id: Types.ObjectId;
  type: 'recharge' | 'deduction' | 'refund' | 'hold' | 'release' | 'credit' | 'debit' | 'initial_credit';
  amount: number;
  balanceAfter: number;
  referenceId: string;
  description: string;
  status: 'pending' | 'success' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const walletTransactionSchema = new Schema<IWalletTransaction>({
  provider_id: { type: Schema.Types.ObjectId, ref: 'Provider', required: true },
  type: {
    type: String,
    enum: ['recharge', 'deduction', 'refund', 'hold', 'release', 'credit', 'debit', 'initial_credit'],
    required: true,
  },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  referenceId: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
}, { timestamps: true });

// Prevent double deduction / double credit for the same entity
walletTransactionSchema.index({ type: 1, referenceId: 1 }, { unique: true });
walletTransactionSchema.index({ provider_id: 1, createdAt: -1 });

export const WalletTransaction = mongoose.model<IWalletTransaction>('WalletTransaction', walletTransactionSchema);
