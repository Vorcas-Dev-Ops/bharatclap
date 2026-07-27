import mongoose, { Schema, Document } from 'mongoose';

export interface IProviderLedger extends Document {
  providerId: mongoose.Types.ObjectId;
  type: 'credit' | 'debit';
  amount: number;
  reason: string;
  bookingId?: mongoose.Types.ObjectId;
  refundId?: mongoose.Types.ObjectId;
  balanceAfter: number;
  createdAt: Date;
}

const ProviderLedgerSchema: Schema = new Schema(
  {
    providerId: { type: Schema.Types.ObjectId, required: true, index: true },
    type: { type: String, enum: ['credit', 'debit'], required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    refundId: { type: Schema.Types.ObjectId, ref: 'Refund' },
    balanceAfter: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const ProviderLedger = mongoose.model<IProviderLedger>('ProviderLedger', ProviderLedgerSchema);
