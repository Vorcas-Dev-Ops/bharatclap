import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProviderLocation extends Document {
  provider_id: Types.ObjectId;
  coordinates: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  heading?: number;
  speed?: number;
  accuracy?: number;
  isOnline: boolean;
  currentStatus: 'idle' | 'on_job' | 'offline';
  lastUpdatedAt: Date;
}

const providerLocationSchema = new Schema<IProviderLocation>(
  {
    provider_id: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
      unique: true,
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    heading: { type: Number },
    speed: { type: Number },
    accuracy: { type: Number },
    isOnline: { type: Boolean, default: false },
    currentStatus: {
      type: String,
      enum: ['idle', 'on_job', 'offline'],
      default: 'idle',
    },
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

providerLocationSchema.index({ coordinates: '2dsphere' });
providerLocationSchema.index({ isOnline: 1 });
providerLocationSchema.index({ provider_id: 1, isOnline: 1 });
providerLocationSchema.index({ lastUpdatedAt: 1 });

export const ProviderLocation = mongoose.model<IProviderLocation>('ProviderLocation', providerLocationSchema);
