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
  },
  { timestamps: true }
);

export const DispatchSetting = mongoose.model<IDispatchSetting>('DispatchSetting', dispatchSettingSchema);
