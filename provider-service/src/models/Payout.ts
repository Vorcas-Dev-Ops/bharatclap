import mongoose, { Schema, Document } from 'mongoose';

export interface IPayout extends Document {
  payoutId: string;
  provider_id: mongoose.Types.ObjectId;
  amount: number;
  status: 'pending' | 'approved' | 'processing' | 'paid' | 'failed' | 'rejected';
  payment_method?: string;
  transaction_id?: string;
  bank_account_id?: string;
  bookingId?: string;
  service?: string;
  customerPaid?: number;
  commission?: number;
  refNumber?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const payoutSchema = new Schema<IPayout>(
  {
    payoutId: { type: String, required: true, unique: true },
    provider_id: { type: Schema.Types.ObjectId, ref: 'Provider', required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'processing', 'paid', 'failed', 'rejected'],
      default: 'pending',
    },
    payment_method: { type: String, enum: ['bank_transfer', 'upi'], default: 'bank_transfer' },
    transaction_id: { type: String },
    bank_account_id: { type: String },
    bookingId: { type: String },
    service: { type: String },
    customerPaid: { type: Number },
    commission: { type: Number },
    refNumber: { type: String },
    processedAt: { type: Date },
  },
  { timestamps: true }
);

export const Payout = mongoose.model<IPayout>('Payout', payoutSchema);
