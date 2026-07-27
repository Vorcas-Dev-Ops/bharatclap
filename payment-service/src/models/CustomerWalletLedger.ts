import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomerWalletLedger extends Document {
  customerId: mongoose.Types.ObjectId;
  type: 'credit' | 'debit';
  amount: number;
  bookingId?: mongoose.Types.ObjectId;
  refundId?: mongoose.Types.ObjectId;
  description: string;
  balanceAfter: number;
  createdAt: Date;
}

const CustomerWalletLedgerSchema: Schema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, required: true, index: true },
    type: { type: String, enum: ['credit', 'debit'], required: true },
    amount: { type: Number, required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    refundId: { type: Schema.Types.ObjectId, ref: 'Refund' },
    description: { type: String, required: true },
    balanceAfter: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const CustomerWalletLedger = mongoose.model<ICustomerWalletLedger>('CustomerWalletLedger', CustomerWalletLedgerSchema);
