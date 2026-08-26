import mongoose, { Document, Schema } from 'mongoose';

export interface IDispatchSetting extends Document {
  distanceWeight: number; // e.g. 40 (%)
  ratingWeight: number; // e.g. 20 (%)
  priorityPackageWeight: number; // e.g. 15 (%)
  loadBalancingWeight: number; // e.g. 15 (%)
  recencyWeight: number; // e.g. 10 (%)
  maxConcurrentJobs: number; // e.g. 3
  maxJobsPerDay: number; // e.g. 20
  responseTimeoutSeconds: number; // e.g. 60
  dispatchRadiusMeters: number; // e.g. 5000
  cooldownConsecutiveLimit: number; // e.g. 5
  cooldownPenaltyFactor: number; // e.g. 20
  autoReassignSeconds: number; // e.g. 60
  defaultSafetyBufferMinutes: number; // e.g. 15
  defaultCleanupMinutes: number; // e.g. 10
  maxAcceptableLatenessMinutes: number; // e.g. 5
  urbanTrafficSpeedKmh: number; // e.g. 25
  routingEngine: 'haversine' | 'osrm' | 'google';
  osrmBaseUrl: string;
  highValueCashConfirmationThreshold: number; // e.g. 2000 (₹)
  paymentExpiryHours: number; // e.g. 24
  // Finance settlement config (ponytail: lives here to avoid a second singleton model)
  gstRateOnCommission: number;        // % — GST on platform commission
  tdsRateOnGross: number;              // % — TDS u/s 194O
  tcsRateOnGross: number;              // % — TCS u/s 206C(1H)
  settlementHoldDays: number;          // days before hold releases
  codBlockThreshold: number;           // ₹ — block dispatch above this COD balance
  codRemitDays: number;                // days to remit COD dues
  defaultCommissionPercentage: number; // % — fallback if booking has no override
  acceptanceTimeoutSeconds: number;    // seconds — per-provider acceptance window (default 600)
  maxRedispatchAttempts: number;       // max redispatches before unassigned_timeout (default 3)
  // Progressive Dispatch Configuration
  tier1ProviderCount: number;          // Top N providers dispatched in Tier 1 (default 5)
  tier1TimeoutSeconds: number;         // Acceptance window for Tier 1 (default 90s)
  tier2ProviderCount: number;          // Next N providers dispatched in Tier 2 (default 10)
  tier2TimeoutSeconds: number;         // Acceptance window for Tier 2 (default 90s)
  radiusExpansionKm: number;           // Radius increment for Tier 3 expansion (default 5 km)
  maxDispatchRadiusKm: number;         // Maximum cap for dispatch search radius (default 30 km)
  createdAt: Date;
  updatedAt: Date;
}

const dispatchSettingSchema = new Schema<IDispatchSetting>(
  {
    distanceWeight: { type: Number, default: 40 },
    ratingWeight: { type: Number, default: 20 },
    priorityPackageWeight: { type: Number, default: 15 },
    loadBalancingWeight: { type: Number, default: 15 },
    recencyWeight: { type: Number, default: 10 },
    maxConcurrentJobs: { type: Number, default: 3 },
    maxJobsPerDay: { type: Number, default: 20 },
    responseTimeoutSeconds: { type: Number, default: 60 },
    dispatchRadiusMeters: { type: Number, default: 5000 },
    cooldownConsecutiveLimit: { type: Number, default: 5 },
    cooldownPenaltyFactor: { type: Number, default: 20 },
    autoReassignSeconds: { type: Number, default: 60 },
    defaultSafetyBufferMinutes: { type: Number, default: 15 },
    defaultCleanupMinutes: { type: Number, default: 10 },
    maxAcceptableLatenessMinutes: { type: Number, default: 5 },
    urbanTrafficSpeedKmh: { type: Number, default: 25 },
    routingEngine: { type: String, enum: ['haversine', 'osrm', 'google'], default: 'haversine' },
    osrmBaseUrl: { type: String, default: 'http://router.project-osrm.org' },
    highValueCashConfirmationThreshold: { type: Number, default: 2000 },
    paymentExpiryHours: { type: Number, default: 24 },
    // Finance settlement config
    gstRateOnCommission: { type: Number, default: 18 },
    tdsRateOnGross: { type: Number, default: 1 },
    tcsRateOnGross: { type: Number, default: 1 },
    settlementHoldDays: { type: Number, default: 3 },
    codBlockThreshold: { type: Number, default: 2000 },
    codRemitDays: { type: Number, default: 3 },
    defaultCommissionPercentage: { type: Number, default: 20 },
    acceptanceTimeoutSeconds: { type: Number, default: 600 },
    maxRedispatchAttempts: { type: Number, default: 3 },
    // Progressive Dispatch Configuration
    tier1ProviderCount: { type: Number, default: 5 },
    tier1TimeoutSeconds: { type: Number, default: 90 },
    tier2ProviderCount: { type: Number, default: 10 },
    tier2TimeoutSeconds: { type: Number, default: 90 },
    radiusExpansionKm: { type: Number, default: 5 },
    maxDispatchRadiusKm: { type: Number, default: 30 },
  },
  { timestamps: true }
);

export const DispatchSetting = mongoose.model<IDispatchSetting>('DispatchSetting', dispatchSettingSchema);
