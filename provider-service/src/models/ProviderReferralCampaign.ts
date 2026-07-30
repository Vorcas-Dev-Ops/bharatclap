import mongoose, { Document, Schema, Types } from 'mongoose';

export type RewardType = 'wallet_credit' | 'lead_package' | 'free_access' | 'coupon' | 'custom';
export type CampaignStatus = 'active' | 'paused' | 'archived' | 'draft';

export interface IQualificationRules {
  minCompletedJobs: number;
  minEarnings: number;
  minRating: number;
  kycRequired: boolean;
  starterKitRequired: boolean;
  walletActive: boolean;
}

export interface IProviderReferralCampaign extends Document {
  name: string;
  description?: string;
  priority: number;
  rewardAmount: number;
  rewardType: RewardType;
  startDate: Date;
  endDate: Date;
  status: CampaignStatus;
  qualificationRules: IQualificationRules;
  expiryDays: number;
  maxReferralsPerProvider: number;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const qualificationRulesSchema = new Schema<IQualificationRules>(
  {
    minCompletedJobs: { type: Number, default: 1 },
    minEarnings: { type: Number, default: 0 },
    minRating: { type: Number, default: 0 },
    kycRequired: { type: Boolean, default: true },
    starterKitRequired: { type: Boolean, default: false },
    walletActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const providerReferralCampaignSchema = new Schema<IProviderReferralCampaign>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    priority: { type: Number, default: 10, index: -1 },
    rewardAmount: { type: Number, required: true, default: 500 },
    rewardType: {
      type: String,
      enum: ['wallet_credit', 'lead_package', 'free_access', 'coupon', 'custom'],
      default: 'wallet_credit',
      required: true,
    },
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['active', 'paused', 'archived', 'draft'],
      default: 'active',
      index: true,
    },
    qualificationRules: { type: qualificationRulesSchema, required: true },
    expiryDays: { type: Number, default: 30 },
    maxReferralsPerProvider: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

providerReferralCampaignSchema.index({ status: 1, priority: -1, startDate: 1, endDate: 1 });

export const ProviderReferralCampaign = mongoose.model<IProviderReferralCampaign>(
  'ProviderReferralCampaign',
  providerReferralCampaignSchema
);
