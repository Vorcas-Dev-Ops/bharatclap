import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProvider extends Document {
  user_id: Types.ObjectId;
  availability_status: 'available' | 'busy' | 'offline' | 'break' | 'vacation';
  isOnline: boolean;
  isBusy: boolean;
  kyc_status: 'pending' | 'verified' | 'rejected';
  is_verified: boolean;
  
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
  /** Set by reconciliation when Provider.walletBalance != sum(WalletTransactions). Cleared after manual review. */
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
  
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const providerSchema = new Schema<IProvider>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
    },
    availability_status: {
      type: String,
      enum: ['available', 'busy', 'offline', 'break', 'vacation'],
      default: 'offline',
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    isBusy: {
      type: Boolean,
      default: false,
    },
    service_locations: [{
      type: Schema.Types.ObjectId,
    }],
    kyc_status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    is_verified: {
      type: Boolean,
      default: false,
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
providerSchema.set('toJSON', { virtuals: true });
providerSchema.set('toObject', { virtuals: true });

providerSchema.index({ live_location: '2dsphere' });
providerSchema.index({ service_locations: 1 });

// Added compound indexes for dispatch and admin query optimization
providerSchema.index({ kyc_status: 1, isDeleted: 1, isOnline: 1 });
providerSchema.index({ service_locations: 1, kyc_status: 1, isDeleted: 1 });
providerSchema.index({ isDeleted: 1, createdAt: -1 });
providerSchema.index({ kyc_status: 1, availability_status: 1, isBusy: 1, createdAt: -1 });
// ─────────────────────────────────────────────────────────────────────────────
// FINANCIAL INTEGRITY GUARD
//
// walletBalance and creditLimit are protected fields.
// The ONLY authorised writer is walletLedgerService, which sets
//   provider.$locals.walletLedgerAuthorized = true
// before calling provider.save(). Any other code path that modifies these
// fields will have its save() call rejected with a thrown Error, rolling back
// the current Mongoose/MongoDB transaction.
//
// Approved exceptions (also set the flag):
//   • reconciliation.ts  — daily balance correction with audit record
//
// ponytail: this guard is the enforcement layer for the wallet write policy
// ─────────────────────────────────────────────────────────────────────────────
providerSchema.pre('save', function(next) {
  const walletModified  = this.isModified('walletBalance');
  const creditModified  = this.isModified('creditLimit');

  if (walletModified || creditModified) {
    if (!this.$locals?.walletLedgerAuthorized) {
      const fields = [walletModified && 'walletBalance', creditModified && 'creditLimit'].filter(Boolean).join(', ');
      return next(new Error(
        `[FINANCIAL INTEGRITY] Direct modification of [${fields}] is forbidden. ` +
        `All wallet changes must go through walletLedgerService. ` +
        `Provider: ${this._id}`
      ));
    }
    console.log(
      `[WALLET AUDIT] Provider ${this._id} — ` +
      (walletModified  ? `walletBalance → ₹${this.walletBalance}  ` : '') +
      (creditModified  ? `creditLimit → ₹${this.creditLimit}` : '')
    );
  }
  next();
});

export const Provider = mongoose.model<IProvider>('Provider', providerSchema);
