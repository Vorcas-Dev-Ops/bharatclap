import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProviderSettlement extends Document {
  provider_id: Types.ObjectId;
  booking_id: Types.ObjectId;
  booking_display_id: string;
  payment_type: 'online' | 'cod';
  gross_amount: number;
  commission_amount: number;
  gst_on_commission: number;
  tds_amount: number;
  tcs_amount: number;
  net_payable_amount: number;
  cod_due_amount: number;
  status: 'pending_hold' | 'ready_for_payout' | 'processing' | 'paid' | 'failed' | 'disputed' | 'held_by_admin' | 'cod_pending' | 'cod_settled';
  hold_ends_at?: Date;
  cod_due_by?: Date;
  paid_at?: Date;
  settlement_batch_id?: string;
  payout_reference_id?: string;
  transaction_reference?: string;
  failure_reason?: string;
  createdAt: Date;
}

const providerSettlementSchema = new Schema<IProviderSettlement>({
  provider_id: { type: Schema.Types.ObjectId, ref: 'Provider', required: true },
  booking_id: { type: Schema.Types.ObjectId, required: true, unique: true },
  booking_display_id: { type: String, required: true },
  payment_type: { type: String, enum: ['online', 'cod'], required: true },
  gross_amount: { type: Number, required: true },
  commission_amount: { type: Number, required: true },
  gst_on_commission: { type: Number, required: true },
  tds_amount: { type: Number, required: true, default: 0 },
  tcs_amount: { type: Number, required: true, default: 0 },
  net_payable_amount: { type: Number, required: true },
  cod_due_amount: { type: Number, required: true, default: 0 },
  status: { 
    type: String, 
    enum: ['pending_hold', 'ready_for_payout', 'processing', 'paid', 'failed', 'disputed', 'held_by_admin', 'cod_pending', 'cod_settled'], 
    required: true 
  },
  hold_ends_at: { type: Date },
  cod_due_by: { type: Date },
  paid_at: { type: Date },
  settlement_batch_id: { type: String },
  payout_reference_id: { type: String, unique: true, sparse: true },
  transaction_reference: { type: String },
  failure_reason: { type: String }
}, { timestamps: true });

providerSettlementSchema.index({ provider_id: 1, status: 1 });
providerSettlementSchema.index({ hold_ends_at: 1 });
providerSettlementSchema.index({ settlement_batch_id: 1 });

export const ProviderSettlement = mongoose.model<IProviderSettlement>('ProviderSettlement', providerSettlementSchema);
