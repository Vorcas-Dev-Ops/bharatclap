import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IWalletTransaction extends Document {
  provider_id: Types.ObjectId;
  type: 'recharge' | 'deduction' | 'refund' | 'hold' | 'release' | 'credit' | 'debit' | 'initial_credit' | 'adjustment';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceId: string;
  description: string;
  status: 'pending' | 'success' | 'failed';
  previous_hash: string;
  current_hash: string;
  fencing_token: number;
  trace_id?: string;
  span_id?: string;
  correlation_id?: string;
  request_id?: string;
  createdAt: Date;
  updatedAt: Date;
}

const walletTransactionSchema = new Schema<IWalletTransaction>(
  {
    provider_id: { type: Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    type: {
      type: String,
      enum: ['recharge', 'deduction', 'refund', 'hold', 'release', 'credit', 'debit', 'initial_credit', 'adjustment'],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    balanceBefore: { type: Number, required: true, default: 0 },
    balanceAfter: { type: Number, required: true, default: 0 },
    referenceId: { type: String, required: true, unique: true, index: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending', index: true },
    previous_hash: { type: String, required: true, default: 'GENESIS_HASH' },
    current_hash: { type: String, required: true, index: true },
    fencing_token: { type: Number, required: true, default: 1, index: true },
    trace_id: { type: String, index: true },
    span_id: { type: String },
    correlation_id: { type: String, index: true },
    request_id: { type: String },
  },
  { timestamps: true }
);

walletTransactionSchema.index({ provider_id: 1, createdAt: -1 });
walletTransactionSchema.index({ provider_id: 1, fencing_token: -1 });

// APPEND-ONLY IMMUTABILITY GUARD: Prevent modification or deletion after creation
walletTransactionSchema.pre('updateOne', function () {
  throw new Error('IMMUTABLE LEDGER: WalletTransaction records cannot be updated or modified.');
});
walletTransactionSchema.pre('findOneAndUpdate', function () {
  throw new Error('IMMUTABLE LEDGER: WalletTransaction records cannot be updated or modified.');
});
walletTransactionSchema.pre('deleteOne', function () {
  throw new Error('IMMUTABLE LEDGER: WalletTransaction records cannot be deleted.');
});
walletTransactionSchema.pre('findOneAndDelete', function () {
  throw new Error('IMMUTABLE LEDGER: WalletTransaction records cannot be deleted.');
});

export const WalletTransaction = mongoose.model<IWalletTransaction>('WalletTransaction', walletTransactionSchema);
