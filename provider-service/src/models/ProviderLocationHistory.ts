import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProviderLocationHistory extends Document {
  provider_id: Types.ObjectId;
  coordinates: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  timestamp: Date;
}

const providerLocationHistorySchema = new Schema<IProviderLocationHistory>(
  {
    provider_id: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
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
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { timestamps: false }
);

providerLocationHistorySchema.index({ provider_id: 1, timestamp: -1 });
providerLocationHistorySchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 }); // TTL of 7 days

export const ProviderLocationHistory = mongoose.model<IProviderLocationHistory>('ProviderLocationHistory', providerLocationHistorySchema);
