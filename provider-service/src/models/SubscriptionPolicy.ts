import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriptionPolicy extends Document {
  policyKey: 'wallet_based' | 'free_trial' | 'premium' | 'sponsored';
  name: string;
  description?: string;
  requiresWallet: boolean;
  deductsLeadFee: boolean;
  durationDays: number; // 0 = custom / unlimited
  gracePeriodDays: number; // default 7
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionPolicySchema = new Schema<ISubscriptionPolicy>(
  {
    policyKey: {
      type: String,
      enum: ['wallet_based', 'free_trial', 'premium', 'sponsored'],
      required: true,
      unique: true,
    },
    name: { type: String, required: true },
    description: { type: String },
    requiresWallet: { type: Boolean, default: true },
    deductsLeadFee: { type: Boolean, default: true },
    durationDays: { type: Number, default: 0 },
    gracePeriodDays: { type: Number, default: 7 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const SubscriptionPolicy = mongoose.model<ISubscriptionPolicy>('SubscriptionPolicy', subscriptionPolicySchema);
