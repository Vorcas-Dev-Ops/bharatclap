import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProviderStats extends Document {
  provider_id: Types.ObjectId;
  todayOrders: number;
  weekOrders: number;
  monthOrders: number;
  yearOrders: number;
  totalCompletedOrders: number;
  totalCancelledOrders: number;
  todayRevenue: number;
  monthRevenue: number;
  totalRevenue: number;
  acceptanceRate: number;
  completionRate: number;
  lastUpdatedDate: string; // YYYY-MM-DD
  createdAt: Date;
  updatedAt: Date;
}

const providerStatsSchema = new Schema<IProviderStats>(
  {
    provider_id: { type: Schema.Types.ObjectId, ref: 'Provider', required: true, unique: true },
    todayOrders: { type: Number, default: 0 },
    weekOrders: { type: Number, default: 0 },
    monthOrders: { type: Number, default: 0 },
    yearOrders: { type: Number, default: 0 },
    totalCompletedOrders: { type: Number, default: 0 },
    totalCancelledOrders: { type: Number, default: 0 },
    todayRevenue: { type: Number, default: 0 },
    monthRevenue: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    acceptanceRate: { type: Number, default: 100 },
    completionRate: { type: Number, default: 100 },
    lastUpdatedDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  },
  { timestamps: true }
);

export const ProviderStats = mongoose.model<IProviderStats>('ProviderStats', providerStatsSchema);
