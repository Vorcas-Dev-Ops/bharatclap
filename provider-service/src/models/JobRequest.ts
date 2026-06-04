import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IJobRequest extends Document {
  booking_id: Types.ObjectId;
  provider_id: Types.ObjectId;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'removed';
  distance?: number;
  expires_at: Date;
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
  },
  {
    timestamps: true,
  }
);

jobRequestSchema.index({ booking_id: 1, provider_id: 1 }, { unique: true });
jobRequestSchema.index({ status: 1 });
jobRequestSchema.index({ expires_at: 1 });

export const JobRequest = mongoose.model<IJobRequest>('JobRequest', jobRequestSchema);
