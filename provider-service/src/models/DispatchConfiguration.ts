import mongoose, { Document, Schema } from 'mongoose';

export interface IDispatchConfiguration extends Document {
  gpsFreshnessSeconds: number; // e.g. 120 (Idle) / 45 (Searching)
  minGpsTrustScore: number;    // e.g. 60
  maxDistanceRadiusKm: number[]; // e.g. [5, 10, 20, 30]
  scoringWeights: {
    distance: number;       // 40
    rating: number;         // 20
    priority: number;       // 15
    loadBalancing: number;  // 15
    recency: number;        // 10
  };
  capacityModeDefault: 'daily' | 'hourly' | 'weekly' | 'unlimited';
  disasterRecoveryMode: 'dual_verification' | 'registered_location_mode' | 'emergency_override';
  updatedAt: Date;
}

const dispatchConfigurationSchema = new Schema<IDispatchConfiguration>(
  {
    gpsFreshnessSeconds: { type: Number, default: 120 },
    minGpsTrustScore: { type: Number, default: 60 },
    maxDistanceRadiusKm: { type: [Number], default: [5, 10, 20, 30] },
    scoringWeights: {
      distance: { type: Number, default: 40 },
      rating: { type: Number, default: 20 },
      priority: { type: Number, default: 15 },
      loadBalancing: { type: Number, default: 15 },
      recency: { type: Number, default: 10 },
    },
    capacityModeDefault: {
      type: String,
      enum: ['daily', 'hourly', 'weekly', 'unlimited'],
      default: 'daily',
    },
    disasterRecoveryMode: {
      type: String,
      enum: ['dual_verification', 'registered_location_mode', 'emergency_override'],
      default: 'dual_verification',
    },
  },
  { timestamps: true }
);

export const DispatchConfiguration = mongoose.model<IDispatchConfiguration>(
  'DispatchConfiguration',
  dispatchConfigurationSchema
);
