import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IJobRequest extends Document {
  booking_id: Types.ObjectId;
  provider_id: Types.ObjectId;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'removed';
  distance?: number;
  expires_at: Date;
  sent_at?: Date;
  expired_at?: Date;
  expired_reason?: string;
  accepted_at?: Date;
  provider_rank?: number;
  dispatchScore?: number;
  dispatchTier?: number; // 1, 2, 3
  distanceKm?: number;
  estimatedTravelMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
}

const jobRequestSchema = new Schema<IJobRequest>(
  {
    booking_id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    provider_id: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'expired', 'removed'],
      default: 'pending',
    },
    distance: {
      type: Number,
    },
    expires_at: {
      type: Date,
      required: true,
    },
    sent_at: {
      type: Date,
    },
    expired_at: {
      type: Date,
    },
    expired_reason: {
      type: String,
    },
    accepted_at: {
      type: Date,
    },
    provider_rank: {
      type: Number,
    },
    dispatchScore: {
      type: Number,
    },
    dispatchTier: {
      type: Number,
      default: 1,
    },
    distanceKm: {
      type: Number,
    },
    estimatedTravelMinutes: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

jobRequestSchema.index({ booking_id: 1, provider_id: 1 }, { unique: true });
jobRequestSchema.index({ status: 1 });
jobRequestSchema.index({ provider_id: 1, status: 1 });
jobRequestSchema.index({ status: 1, expires_at: 1 });
jobRequestSchema.index({ provider_id: 1, status: 1, expires_at: 1 });
jobRequestSchema.index({ booking_id: 1, status: 1 });
// ponytail: removed TTL index { expires_at: 1, expireAfterSeconds: 0 } — preserves expired records for audit.
// After deployment, drop the existing TTL index from production: db.jobrequests.dropIndex("expires_at_1")

export const JobRequest = mongoose.model<IJobRequest>('JobRequest', jobRequestSchema);
