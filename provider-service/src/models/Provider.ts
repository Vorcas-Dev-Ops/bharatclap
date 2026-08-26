import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProvider extends Document {
  provider_code?: string;
  user_id: Types.ObjectId;
  availability_status: 'available' | 'busy' | 'offline' | 'break' | 'vacation' | 'blocked';
  status?: 'active' | 'suspended' | 'blocked';
  isOnline: boolean;
  isBusy: boolean;
  max_concurrent_jobs?: number;
  rating_count?: number;
  average_rating?: number;
  kyc_status: 'pending' | 'verified' | 'rejected';
  is_verified: boolean;
  gender?: 'male' | 'female' | 'other' | 'MALE' | 'FEMALE' | 'ANY' | string;
  
  providerKitCompleted: boolean;
  accessoriesPurchased: boolean;
  onboardingCompleted: boolean;

  kitPurchased: boolean;
  kitPurchasedAt?: Date;
  kitOrderId?: Types.ObjectId;
  walletBalance: number;
  wallet_initialized: boolean;
  reservedBalance: number;
  creditLimit: number;
  isWalletBlocked: boolean;
  walletStatus: 'active' | 'frozen_manual' | 'frozen_auto' | 'pending_approval' | 'suspended';
  walletVersion?: number;
  fencing_token?: number;
  wallet_dirty?: boolean;
  walletDiscrepancyFlagged?: boolean;
  walletDiscrepancyDetails?: {
    detectedAt: Date;
    cachedBalance: number;
    computedBalance: number;
    diff: number;
    runId: string;
  };
  freezeDetails?: {
    frozenAt?: Date | null;
    frozenBy?: string | null;
    freezeReason?: string | null;
    freezeRemarks?: string | null;
    freezeType?: 'manual' | 'auto' | null;
  };

  // Referral Program
  referral_code?: string;
  referred_by?: Types.ObjectId;
  successful_referrals?: number;

  // Subscription & Access Mode Control
  subscriptionType: 'wallet_based' | 'free_trial';
  accessMode: 'standard' | 'premium' | 'sponsored';
  subscriptionStatus: 'active' | 'expiring' | 'grace_period' | 'expired' | 'suspended';
  isFreeAccessEnabled: boolean;
  freeAccessStartDate?: Date | null;
  freeAccessEndDate?: Date | null;
  gracePeriodEndDate?: Date | null;
  freeAccessReason?: string;
  freeAccessAssignedBy?: string;

  // Workload & Recency Load Balancing Tracking
  jobsAssignedToday?: number;
  jobsCompletedToday?: number;
  consecutiveJobsToday?: number;
  rejectionCount30d?: number;
  cancellationCount30d?: number;
  acceptanceRate?: number;
  fraudPenaltyScore?: number;
  lastJobAssignedAt?: Date | null;
  lastLeadNotificationThreshold?: number;
  
  // Virtual computed credit
  readonly availableCredit: number;

  bankDetails?: {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    status: 'pending' | 'verified' | 'failed';
  };
  razorpay_contact_id?: string;
  razorpay_fund_account_id?: string;
  fund_account_validation_id?: string; // correlates async validation webhook back to provider
  razorpay_account_status?: 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'FAILED' | 'SUSPENDED';
  bank_verified_at?: Date;
  bank_last_4?: string;
  upi_id?: string;
  upi_display_name?: string;
  upi_status?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  upi_verified_at?: Date;
  upi_verification_reference?: string;
  cash_fallback_count?: number;
  total_jobs_completed?: number;
  readonly cash_fallback_rate?: number;

  codDueBalance: number;
  isDispatchBlockedByCod: boolean;
  
  // Service Areas
  service_locations: Types.ObjectId[]; // IDs from Locations collection

  // Live Tracking
  live_location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  serviceRadius: number; // in meters (default 10000)
  socketId?: string;
  lastActiveAt?: Date;

  // Legacy/Other
  aadhar_last4?: string;
  aadhar_hash?: string;
  bank_details?: {
    account_holder_name: string;
    account_number_last4: string;
    account_number_hash: string;
    ifsc_code: string;
    bank_name: string;
    branch: string;
  };
  verification_docs?: {
    id_proof_url: string;
    public_id?: string;
    resource_type?: string;
  };
  kyc_rejection_reason?: string;
  verified_at?: Date;
  verification_docs_expiry?: Date;
  lastSeenAt?: Date;
  offlineReason?: 'manual_offline' | 'network_timeout' | 'disconnected' | 'heartbeat_timeout';
  
  // Onboarding Status System
  onboarding_status: 'DRAFT' | 'UNDER_REVIEW' | 'ACTION_REQUIRED' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  onboarding_step: number; // last visited wizard step (0-3)
  onboarding_draft?: any;  // temporary wizard UI state (category/service selections)

  // Business and profile fields
  business_name?: string;
  experience?: number;
  category?: string;
  service_areas?: string[];
  address?: string;

  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const providerSchema = new Schema<IProvider>(
  {
    provider_code: {
      type: String,
      immutable: true,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
    },
    gender: {
      type: String,
      trim: true,
    },
    availability_status: {
      type: String,
      enum: ['available', 'busy', 'offline', 'break', 'vacation', 'blocked'],
      default: 'offline',
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'blocked'],
      default: 'active',
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    isBusy: {
      type: Boolean,
      default: false,
    },
    max_concurrent_jobs: {
      type: Number,
      default: 1,
    },
    rating_count: {
      type: Number,
      default: 0,
    },
    average_rating: {
      type: Number,
      default: 5.0,
    },
    service_locations: {
      type: [Schema.Types.ObjectId],
      default: [],
    },
    business_name: { type: String, trim: true },
    experience: { type: Number },
    category: { type: String, trim: true },
    service_areas: [{ type: String, trim: true }],
    address: { type: String, trim: true },
    kyc_status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    is_verified: {
      type: Boolean,
      default: false,
    },
    onboarding_status: {
      type: String,
      enum: ['DRAFT', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'APPROVED', 'REJECTED', 'SUSPENDED'],
      default: 'DRAFT',
      index: true,
    },
    onboarding_step: {
      type: Number,
      default: 0,
    },
    onboarding_draft: {
      type: Schema.Types.Mixed,
      default: null,
    },
    referral_code: {
      type: String,
      uppercase: true,
      trim: true,
      sparse: true,
      index: true,
    },
    referred_by: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
    },
    successful_referrals: {
      type: Number,
      default: 0,
    },
    providerKitCompleted: {
      type: Boolean,
      default: false,
    },
    accessoriesPurchased: {
      type: Boolean,
      default: false,
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    kitPurchased: {
      type: Boolean,
      default: false,
    },
    kitPurchasedAt: { type: Date },
    kitOrderId: { type: Schema.Types.ObjectId, ref: 'ProviderOrder' },
    walletBalance: {
      type: Number,
      default: 0,
    },
    wallet_initialized: {
      type: Boolean,
      default: false,
    },
    reservedBalance: {
      type: Number,
      default: 0,
    },
    isWalletBlocked: {
      type: Boolean,
      default: false,
    },
    walletStatus: {
      type: String,
      enum: ['active', 'frozen_manual', 'frozen_auto', 'pending_approval', 'suspended'],
      default: 'active',
    },
    freezeDetails: {
      frozenAt: { type: Date, default: null },
      frozenBy: { type: String, default: null },
      freezeReason: { type: String, default: null },
      freezeRemarks: { type: String, default: null },
      freezeType: { type: String, enum: ['manual', 'auto', null], default: null },
    },
    creditLimit: {
      type: Number,
      default: 0,
    },
    walletVersion: {
      type: Number,
      default: 0,
    },
    fencing_token: {
      type: Number,
      default: 0,
    },
    wallet_dirty: {
      type: Boolean,
      default: false,
      index: true,
    },
    walletDiscrepancyFlagged: { type: Boolean, default: false },
    walletDiscrepancyDetails: {
      detectedAt: { type: Date },
      cachedBalance: { type: Number },
      computedBalance: { type: Number },
      diff: { type: Number },
      runId: { type: String },
    },
    subscriptionType: {
      type: String,
      enum: ['wallet_based', 'free_trial'],
      default: 'wallet_based',
    },
    accessMode: {
      type: String,
      enum: ['standard', 'premium', 'sponsored'],
      default: 'standard',
    },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'expiring', 'grace_period', 'expired', 'suspended'],
      default: 'active',
    },
    isFreeAccessEnabled: {
      type: Boolean,
      default: false,
    },
    freeAccessStartDate: { type: Date, default: null },
    freeAccessEndDate: { type: Date, default: null },
    gracePeriodEndDate: { type: Date, default: null },
    freeAccessReason: { type: String },
    freeAccessAssignedBy: { type: String },
    jobsAssignedToday: { type: Number, default: 0 },
    jobsCompletedToday: { type: Number, default: 0 },
    consecutiveJobsToday: { type: Number, default: 0 },
    rejectionCount30d: { type: Number, default: 0 },
    cancellationCount30d: { type: Number, default: 0 },
    acceptanceRate: { type: Number, default: 100 },
    fraudPenaltyScore: { type: Number, default: 0 },
    lastJobAssignedAt: { type: Date, default: null },
    lastLeadNotificationThreshold: { type: Number, default: -1 },
    bankDetails: {
      accountHolderName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
      bankName: { type: String, trim: true },
      status: { type: String, enum: ['pending', 'verified', 'failed'], default: 'pending' }
    },
    razorpay_contact_id: { type: String, index: true },
    razorpay_fund_account_id: { type: String, index: true },
    fund_account_validation_id: { type: String, index: true },
    razorpay_account_status: { type: String, enum: ['PENDING', 'UNDER_REVIEW', 'VERIFIED', 'FAILED', 'SUSPENDED'], default: 'PENDING' },
    bank_verified_at: { type: Date },
    bank_last_4: { type: String },
    codDueBalance: {
      type: Number,
      default: 0,
    },
    isDispatchBlockedByCod: {
      type: Boolean,
      default: false,
    },
    live_location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
    serviceRadius: {
      type: Number,
      default: 10000, // 10km in meters
    },
    socketId: {
      type: String,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    aadhar_last4: { type: String, trim: true },
    aadhar_hash: { type: String },
    bank_details: {
      account_holder_name: { type: String, trim: true },
      account_number_last4: { type: String, trim: true },
      account_number_hash: { type: String },
      ifsc_code: { type: String, trim: true },
      bank_name: { type: String, trim: true },
      branch: { type: String, trim: true },
    },
    verification_docs: {
      id_proof_url: { type: String, trim: true },
      public_id: { type: String, trim: true },
      resource_type: { type: String, trim: true },
    },
    kyc_rejection_reason: { type: String },
    verified_at: { type: Date },
    verification_docs_expiry: { type: Date },
    lastSeenAt: { type: Date },
    offlineReason: { type: String, enum: ['manual_offline', 'network_timeout', 'disconnected', 'heartbeat_timeout'] },
    upi_id: { type: String, trim: true, index: true, sparse: true },
    upi_display_name: { type: String, trim: true },
    upi_status: { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED'], default: 'PENDING' },
    upi_verified_at: { type: Date },
    upi_verification_reference: { type: String, trim: true },
    cash_fallback_count: { type: Number, default: 0 },
    total_jobs_completed: { type: Number, default: 0 },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

providerSchema.virtual('availableCredit').get(function(this: IProvider) {
  return (this.walletBalance || 0) - (this.reservedBalance || 0) + (this.creditLimit || 0);
});

providerSchema.virtual('cash_fallback_rate').get(function(this: IProvider) {
  const total = this.total_jobs_completed || 0;
  if (total === 0) return 0;
  return Number((((this.cash_fallback_count || 0) / total) * 100).toFixed(2));
});
providerSchema.set('toJSON', { virtuals: true });
providerSchema.set('toObject', { virtuals: true });

providerSchema.index({ live_location: '2dsphere' });
providerSchema.index({ service_locations: 1 });
providerSchema.index({ kyc_status: 1, isDeleted: 1, isOnline: 1 });
providerSchema.index({ service_locations: 1, kyc_status: 1, isDeleted: 1 });
providerSchema.index({ isDeleted: 1, createdAt: -1 });
providerSchema.index({ kyc_status: 1, availability_status: 1, isBusy: 1, createdAt: -1 });

providerSchema.pre('save', function(next) {
  const walletModified = this.isModified('walletBalance');
  const creditModified = this.isModified('creditLimit');

  if (walletModified || creditModified) {
    if (!this.$locals?.walletLedgerAuthorized) {
      const fields = [walletModified && 'walletBalance', creditModified && 'creditLimit'].filter(Boolean).join(', ');
      return next(new Error(
        `[FINANCIAL INTEGRITY] Direct modification of [${fields}] is forbidden. ` +
        `All wallet changes must go through walletLedgerService. ` +
        `Provider: ${this._id}`
      ));
    }
  }

  // ponytail: Rating Safety Guard — completed_jobs >= 20 AND rating_count >= 20 AND average_rating < 3.5 -> Blocked
  if ((this.jobsCompletedToday || 0) >= 20 && (this.rating_count || 0) >= 20 && (this.average_rating || 5.0) < 3.5) {
    this.availability_status = 'blocked';
    this.status = 'blocked';
  }

  next();
});

providerSchema.pre(/^find/, function(this: any) {
  if (!this.getOptions()?.includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

export const Provider = mongoose.model<IProvider>('Provider', providerSchema);
