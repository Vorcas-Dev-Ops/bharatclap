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
  provider_rank?: number;
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
    provider_rank: {
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
jobRequestSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const JobRequest = mongoose.model<IJobRequest>('JobRequest', jobRequestSchema);
