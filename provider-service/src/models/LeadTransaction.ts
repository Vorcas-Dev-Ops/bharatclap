import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILeadTransaction extends Document {
  provider_id: Types.ObjectId;
  package_order_id?: Types.ObjectId;
  type: 'purchase' | 'deduction' | 'bonus' | 'refund' | 'expiry' | 'admin_credit' | 'admin_debit' | 'hybrid_wallet';
  leadAmount: number;
  balance_before?: number;
  balanceAfter: number;
  idempotency_key?: string;
  correlation_id?: string;
  referenceId?: string; // booking_id or order_id
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const leadTransactionSchema = new Schema<ILeadTransaction>(
  {
    provider_id: { type: Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    package_order_id: { type: Schema.Types.ObjectId, ref: 'LeadPackageOrder' },
    type: {
      type: String,
      enum: ['purchase', 'deduction', 'bonus', 'refund', 'expiry', 'admin_credit', 'admin_debit', 'hybrid_wallet'],
      required: true,
      index: true,
    },
    leadAmount: { type: Number, required: true },
    balance_before: { type: Number },
    balanceAfter: { type: Number, required: true },
    idempotency_key: { type: String, unique: true, sparse: true, index: true },
    correlation_id: { type: String, index: true },
    referenceId: { type: String, index: true },
    description: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const LeadTransaction = mongoose.model<ILeadTransaction>('LeadTransaction', leadTransactionSchema);

