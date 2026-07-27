import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILeadTransaction extends Document {
  provider_id: Types.ObjectId;
  package_order_id?: Types.ObjectId;
  type: 'purchase' | 'deduction' | 'bonus' | 'refund' | 'expiry';
  leadAmount: number;
  balanceAfter: number;
  referenceId?: string; // booking_id or order_id
  description?: string;
  createdAt: Date;
}

const leadTransactionSchema = new Schema<ILeadTransaction>(
  {
    provider_id: { type: Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    package_order_id: { type: Schema.Types.ObjectId, ref: 'LeadPackageOrder' },
    type: { type: String, enum: ['purchase', 'deduction', 'bonus', 'refund', 'expiry'], required: true },
    leadAmount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    referenceId: { type: String },
    description: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const LeadTransaction = mongoose.model<ILeadTransaction>('LeadTransaction', leadTransactionSchema);
