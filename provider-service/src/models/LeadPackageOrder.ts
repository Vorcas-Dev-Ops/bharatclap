import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILeadPackageOrder extends Document {
  provider_id: Types.ObjectId;
  package_id: Types.ObjectId;
  packageName: string;
  price: number;
  baseLeads: number;
  bonusLeads: number;
  totalLeadsGranted: number;
  leadsRemaining: number;
  hasPriorityDispatch: boolean;
  purchasedAt: Date;
  expiresAt: Date | null;
  paymentStatus: 'pending' | 'success' | 'failed';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const leadPackageOrderSchema = new Schema<ILeadPackageOrder>(
  {
    provider_id: { type: Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    package_id: { type: Schema.Types.ObjectId, ref: 'LeadPackage', required: true },
    packageName: { type: String, required: true },
    price: { type: Number, required: true },
    baseLeads: { type: Number, required: true },
    bonusLeads: { type: Number, default: 0 },
    totalLeadsGranted: { type: Number, required: true },
    leadsRemaining: { type: Number, required: true },
    hasPriorityDispatch: { type: Boolean, default: false },
    purchasedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    paymentStatus: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
  },
  { timestamps: true }
);

export const LeadPackageOrder = mongoose.model<ILeadPackageOrder>('LeadPackageOrder', leadPackageOrderSchema);
