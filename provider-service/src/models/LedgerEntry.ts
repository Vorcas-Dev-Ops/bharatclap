import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILedgerEntry extends Document {
  entry_id: string;
  provider_id?: Types.ObjectId;
  booking_id?: Types.ObjectId;
  settlement_id?: Types.ObjectId;
  transaction_type: 'customer_payment' | 'commission_fee' | 'gst_tax' | 'tds_tax' | 'provider_payout' | 'cod_remittance' | 'refund';
  debit_account: string;  // e.g. 'CUSTOMER', 'PLATFORM_ESCROW', 'PROVIDER_WALLET'
  credit_account: string; // e.g. 'PLATFORM_REVENUE', 'PROVIDER_PAYABLE', 'GOVT_TAX'
  amount: number;
  currency: string;
  reference_id: string;
  description: string;
  createdAt: Date;
}

const ledgerEntrySchema = new Schema<ILedgerEntry>(
  {
    entry_id: { type: String, required: true, unique: true, index: true },
    provider_id: { type: Schema.Types.ObjectId, ref: 'Provider', index: true },
    booking_id: { type: Schema.Types.ObjectId, index: true },
    settlement_id: { type: Schema.Types.ObjectId, ref: 'ProviderSettlement', index: true },
    transaction_type: {
      type: String,
      enum: ['customer_payment', 'commission_fee', 'gst_tax', 'tds_tax', 'provider_payout', 'cod_remittance', 'refund'],
      required: true,
    },
    debit_account: { type: String, required: true },
    credit_account: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    reference_id: { type: String, required: true },
    description: { type: String, required: true },
  },
  { timestamps: true }
);

ledgerEntrySchema.index({ createdAt: -1 });

export const LedgerEntry = mongoose.model<ILedgerEntry>('LedgerEntry', ledgerEntrySchema);
