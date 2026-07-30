import mongoose, { Document, Schema, Types } from 'mongoose';

export type ProviderReferralStatus =
  | 'registered'
  | 'kyc_pending'
  | 'starter_kit_pending'
  | 'waiting_first_job'
  | 'qualified'
  | 'reward_processing'
  | 'rewarded'
  | 'fraud_review'
  | 'expired'
  | 'rejected';

export interface IProviderReferral extends Document {
  referrerProviderId: Types.ObjectId;
  referredProviderId: Types.ObjectId;
  referralCode: string;
  campaignId?: Types.ObjectId;
  status: ProviderReferralStatus;
  rewardAmount: number;
  rewardType: string;
  qualificationRulesSnapshot?: {
    minCompletedJobs: number;
    minEarnings: number;
    minRating: number;
    kycRequired: boolean;
    starterKitRequired: boolean;
    walletActive: boolean;
  };
  expiresAt: Date;
  idempotencyKey?: string;
  qualificationBookingId?: Types.ObjectId;
  rewardedAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const providerReferralSchema = new Schema<IProviderReferral>(
  {
    referrerProviderId: { type: Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    referredProviderId: { type: Schema.Types.ObjectId, ref: 'Provider', required: true, unique: true, index: true },
    referralCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    campaignId: { type: Schema.Types.ObjectId, ref: 'ProviderReferralCampaign', index: true },
    status: {
      type: String,
      enum: [
        'registered',
        'kyc_pending',
        'starter_kit_pending',
        'waiting_first_job',
        'qualified',
        'reward_processing',
        'rewarded',
        'fraud_review',
        'expired',
        'rejected',
      ],
      default: 'registered',
      required: true,
      index: true,
    },
    rewardAmount: { type: Number, required: true, default: 500 },
    rewardType: { type: String, default: 'wallet_credit' },
    qualificationRulesSnapshot: {
      minCompletedJobs: { type: Number, default: 1 },
      minEarnings: { type: Number, default: 0 },
      minRating: { type: Number, default: 0 },
      kycRequired: { type: Boolean, default: true },
      starterKitRequired: { type: Boolean, default: false },
      walletActive: { type: Boolean, default: true },
    },
    expiresAt: { type: Date, required: true, index: true },
    idempotencyKey: { type: String, unique: true, sparse: true, index: true },
    qualificationBookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    rewardedAt: { type: Date },
    failureReason: { type: String },
  },
  { timestamps: true }
);

providerReferralSchema.index({ referrerProviderId: 1, status: 1 });
providerReferralSchema.index({ createdAt: -1 });

export const ProviderReferral = mongoose.model<IProviderReferral>('ProviderReferral', providerReferralSchema);
