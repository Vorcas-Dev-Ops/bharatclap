import mongoose, { Schema, Document } from 'mongoose';

export interface IReferralReward extends Document {
  referralId: mongoose.Types.ObjectId; // References CustomerReferral
  referrerId: mongoose.Types.ObjectId;
  refereeId: mongoose.Types.ObjectId;
  rewardType: 'wallet_credit' | 'coupon';
  rewardValue: number; // e.g. 100
  status: 'pending' | 'completed' | 'reversed' | 'fraud_hold';
  reversalReason?: string;
  reversedBy?: mongoose.Types.ObjectId; // Admin user ID
}

const referralRewardSchema = new Schema<IReferralReward>(
  {
    referralId: { type: Schema.Types.ObjectId, ref: 'CustomerReferral', required: true, unique: true },
    referrerId: { type: Schema.Types.ObjectId, required: true },
    refereeId: { type: Schema.Types.ObjectId, required: true },
    rewardType: { type: String, enum: ['wallet_credit', 'coupon'], default: 'wallet_credit', required: true },
    rewardValue: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'completed', 'reversed', 'fraud_hold'], default: 'pending', required: true },
    reversalReason: { type: String },
    reversedBy: { type: Schema.Types.ObjectId }
  },
  { timestamps: true }
);

referralRewardSchema.index({ referrerId: 1, status: 1 });

export const ReferralReward = mongoose.model<IReferralReward>('ReferralReward', referralRewardSchema);
