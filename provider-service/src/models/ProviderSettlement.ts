import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAuditTrailEntry {
  action: string;
  performed_by?: Types.ObjectId | string;
  timestamp: Date;
  notes?: string;
}

export interface IProviderSettlement extends Document {
  provider_id: Types.ObjectId;
  booking_id: Types.ObjectId;
  booking_display_id: string;
  service_name?: string;
  variant_name?: string;
  payment_type: 'online' | 'cod';
  gross_amount: number;
  commission_percentage: number;
  commission_amount: number;
  gst_on_commission: number;
  tds_amount: number;
  tcs_amount: number;
  net_payable_amount: number;
  cod_due_amount: number;
  status: 'pending_hold' | 'ready_for_payout' | 'processing' | 'paid' | 'failed' | 'disputed' | 'held_by_admin' | 'cod_pending' | 'cod_settled' | 'cancelled';
  is_locked: boolean; // Concurrency lock to prevent dual-release by admins
  utr_number?: string;
  bank_reference_number?: string;
  commission_version?: string;
  hold_ends_at?: Date;
  cod_due_by?: Date;
  paid_at?: Date;
  settlement_batch_id?: string;
  payout_reference_id?: string;
  transaction_reference?: string;
  gateway_payout_response?: Record<string, any>;
  failure_reason?: string;
  payout_attempts: number;
  audit_trail: IAuditTrailEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const auditTrailSchema = new Schema<IAuditTrailEntry>(
  {
    action: { type: String, required: true },
    performed_by: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
    notes: { type: String },
  },
  { _id: false }
);

const providerSettlementSchema = new Schema<IProviderSettlement>(
  {
    provider_id: { type: Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    booking_id: { type: Schema.Types.ObjectId, required: true, unique: true },
    booking_display_id: { type: String, required: true },
    service_name: { type: String },
    variant_name: { type: String },
    payment_type: { type: String, enum: ['online', 'cod'], required: true },
    gross_amount: { type: Number, required: true },
    commission_percentage: { type: Number, required: true, default: 20 },
    commission_amount: { type: Number, required: true },
    gst_on_commission: { type: Number, required: true },
    tds_amount: { type: Number, required: true, default: 0 },
    tcs_amount: { type: Number, required: true, default: 0 },
    net_payable_amount: { type: Number, required: true },
    cod_due_amount: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ['pending_hold', 'ready_for_payout', 'processing', 'paid', 'failed', 'disputed', 'held_by_admin', 'cod_pending', 'cod_settled', 'cancelled'],
      required: true,
    },
    is_locked: { type: Boolean, default: false, index: true },
    utr_number: { type: String, index: true },
    bank_reference_number: { type: String },
    commission_version: { type: String, default: 'v1.0' },
    hold_ends_at: { type: Date },
    cod_due_by: { type: Date },
    paid_at: { type: Date },
    settlement_batch_id: { type: String },
    payout_reference_id: { type: String, unique: true, sparse: true },
    transaction_reference: { type: String },
    gateway_payout_response: { type: Schema.Types.Mixed },
    failure_reason: { type: String },
    payout_attempts: { type: Number, required: true, default: 0 },
    audit_trail: [auditTrailSchema],
  },
  {
    timestamps: true,
    optimisticConcurrency: true // Enable optimistic concurrency control (__v)
  }
);

providerSettlementSchema.index({ provider_id: 1, status: 1 });
providerSettlementSchema.index({ hold_ends_at: 1 });
providerSettlementSchema.index({ settlement_batch_id: 1 });

export const ProviderSettlement = mongoose.model<IProviderSettlement>('ProviderSettlement', providerSettlementSchema);
