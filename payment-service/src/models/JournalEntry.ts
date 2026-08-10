import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IJournalEntry extends Document {
  journal_id: string;
  booking_id?: Types.ObjectId | string;
  payment_id?: Types.ObjectId | string;
  provider_id?: Types.ObjectId | string;
  user_id?: Types.ObjectId | string;
  settlement_id?: Types.ObjectId | string;
  correlation_id?: string;
  entry_type: 'payment_received' | 'cod_collected' | 'wallet_debited' | 'commission_charged' | 'gst_charged' | 'settlement_hold' | 'payout_transferred' | 'refund_issued' | 'reversing_adjustment';
  debit_account: string;
  credit_account: string;
  amount: number;
  currency: string;
  description: string;
  metadata?: Record<string, any>;
  is_reconciled: boolean;
  reconciled_at?: Date;
  createdAt: Date;
}

const journalEntrySchema = new Schema<IJournalEntry>(
  {
    journal_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    booking_id: { type: Schema.Types.Mixed, index: true },
    payment_id: { type: Schema.Types.Mixed, index: true },
    provider_id: { type: Schema.Types.Mixed, index: true },
    user_id: { type: Schema.Types.Mixed, index: true },
    settlement_id: { type: Schema.Types.Mixed, index: true },
    correlation_id: { type: String, index: true },
    entry_type: {
      type: String,
      required: true,
    },
    debit_account: { type: String, required: true },
    credit_account: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    description: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    is_reconciled: { type: Boolean, default: false },
    reconciled_at: { type: Date },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable journal entries!
  }
);

journalEntrySchema.index({ booking_id: 1, entry_type: 1 });
journalEntrySchema.index({ createdAt: -1 });

export const JournalEntry = mongoose.model<IJournalEntry>('JournalEntry', journalEntrySchema);
