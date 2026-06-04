import mongoose, { Schema, Document } from 'mongoose';

export interface IPayout extends Document {
  provider_id: mongoose.Types.ObjectId;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payment_method?: string;
  transaction_id?: string;
  bank_account_id?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const payoutSchema = new Schema<IPayout>(
  {
    provider_id: { type: Schema.Types.ObjectId, ref: 'Provider', required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    payment_method: { type: String, enum: ['bank_transfer', 'upi'], default: 'bank_transfer' },
    transaction_id: { type: String },
    bank_account_id: { type: String },
    processedAt: { type: Date },
  },
  { timestamps: true }
);

export const Payout = mongoose.model<IPayout>('Payout', payoutSchema);
