import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProviderLocationDailyStats extends Document {
  provider_id: Types.ObjectId;
  location_id: Types.ObjectId;
  date: string; // "YYYY-MM-DD"
  bookings_assigned: number;
  bookings_completed: number;
  bookings_cancelled: number;
  createdAt: Date;
  updatedAt: Date;
}

const providerLocationDailyStatsSchema = new Schema<IProviderLocationDailyStats>(
  {
    provider_id: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    location_id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    bookings_assigned: {
      type: Number,
      default: 0,
    },
    bookings_completed: {
      type: Number,
      default: 0,
    },
    bookings_cancelled: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Compound unique index to guarantee single stat record per provider per location per day
providerLocationDailyStatsSchema.index(
  { provider_id: 1, location_id: 1, date: 1 },
  { unique: true }
);

export const ProviderLocationDailyStats = mongoose.model<IProviderLocationDailyStats>(
  'ProviderLocationDailyStats',
  providerLocationDailyStatsSchema
);
