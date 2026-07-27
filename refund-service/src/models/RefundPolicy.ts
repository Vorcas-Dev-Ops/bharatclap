import mongoose, { Schema, Document } from 'mongoose';

export interface IRefundPolicy extends Document {
  category: string;
  earlyCancellationHours: number;
  refundPercentage: number;
  providerCompensation: number;
  platformFee: number;
  walletRefundEnabled: boolean;
  gatewayRefundEnabled: boolean;
  autoApprovalLimit: number;
}

const RefundPolicySchema: Schema = new Schema(
  {
    category: { type: String, required: true, unique: true, default: 'default' },
    earlyCancellationHours: { type: Number, default: 2 },
    refundPercentage: { type: Number, default: 100 },
    providerCompensation: { type: Number, default: 100 },
    platformFee: { type: Number, default: 0 },
    walletRefundEnabled: { type: Boolean, default: true },
    gatewayRefundEnabled: { type: Boolean, default: true },
    autoApprovalLimit: { type: Number, default: 5000 },
  },
  { timestamps: true }
);

export const RefundPolicy = mongoose.model<IRefundPolicy>('RefundPolicy', RefundPolicySchema);
