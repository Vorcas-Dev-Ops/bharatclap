import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * BHARATCLAP LEDGER CONVENTION SPECIFICATION:
 * 
 * 1. DEBIT ACCOUNT (Inflow / Asset Account):
 *    Represents cash received or held by BharatClap.
 *    e.g. 'HUB_CASH_ACCOUNT' (+ Asset), 'ONLINE_UPI' (+ Bank/UPI Inflow), 'CUSTOMER_ESCROW' (+ Customer Inflow).
 * 
 * 2. CREDIT ACCOUNT (Outflow / Liability / Revenue Reduction):
 *    Represents reduction of liability, revenue recognition, or tax payable.
 *    e.g. 'PROVIDER_COD_LIABILITY' (- Provider Debt Liability), 'PLATFORM_COMMISSION_REVENUE', 'GOVT_GST_PAYABLE'.
 * 
 * EXAMPLE: Admin Hub Cash Remittance (₹885)
 * - DEBIT:  HUB_CASH_ACCOUNT        +₹885 (Hub Cash Asset +₹885)
 * - CREDIT: PROVIDER_COD_LIABILITY  -₹885 (Provider Debt Liability -₹885 -> 0)
 * Balance Equation: Total Assets (+₹885) = Total Liabilities (-₹885) + Equity (₹0) -> Difference = ₹0
 * 
 * DO NOT INVERT THIS CONVENTION. It is the authoritative double-entry model for BharatClap.
 */
export interface ILedgerEntry extends Document {
  entry_id: string;
  provider_id?: Types.ObjectId;
  booking_id?: Types.ObjectId;
  settlement_id?: Types.ObjectId;
  transaction_type: 'customer_payment' | 'commission_fee' | 'gst_tax' | 'tds_tax' | 'provider_payout' | 'cod_remittance' | 'cod_collected' | 'cod_deposited' | 'wallet_credit' | 'wallet_debit' | 'adjustment' | 'penalty' | 'payout' | 'refund';
  debit_account: string;  // e.g. 'CUSTOMER', 'PLATFORM_ESCROW', 'PROVIDER_WALLET'
  credit_account: string; // e.g. 'PLATFORM_REVENUE', 'PROVIDER_PAYABLE', 'GOVT_TAX'
  amount: number;
  balance_after?: number;
  currency: string;
  reference_id: string;
  description: string;
  metadata?: Record<string, any>;
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
      enum: ['customer_payment', 'commission_fee', 'gst_tax', 'tds_tax', 'provider_payout', 'cod_remittance', 'cod_collected', 'cod_deposited', 'wallet_credit', 'wallet_debit', 'adjustment', 'penalty', 'payout', 'refund'],
      required: true,
    },
    debit_account: { type: String, required: true },
    credit_account: { type: String, required: true },
    amount: { type: Number, required: true },
    balance_after: { type: Number },
    currency: { type: String, default: 'INR' },
    reference_id: { type: String, required: true },
    description: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

ledgerEntrySchema.index({ createdAt: -1 });

// ponytail: append-only immutability — same pattern as WalletTransaction
ledgerEntrySchema.pre('updateOne', function () {
  throw new Error('IMMUTABLE LEDGER: LedgerEntry records cannot be updated.');
});
ledgerEntrySchema.pre('findOneAndUpdate', function () {
  throw new Error('IMMUTABLE LEDGER: LedgerEntry records cannot be updated.');
});
ledgerEntrySchema.pre('deleteOne', function () {
  throw new Error('IMMUTABLE LEDGER: LedgerEntry records cannot be deleted.');
});
ledgerEntrySchema.pre('findOneAndDelete', function () {
  throw new Error('IMMUTABLE LEDGER: LedgerEntry records cannot be deleted.');
});

export const LedgerEntry = mongoose.model<ILedgerEntry>('LedgerEntry', ledgerEntrySchema);
