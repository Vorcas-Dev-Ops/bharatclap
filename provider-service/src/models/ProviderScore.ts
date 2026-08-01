import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProviderScore extends Document {
  provider_id: Types.ObjectId;
  acceptance_rate: number;
  cancellation_rate: number;
  late_arrival_rate: number;
  response_time_sec: number;
  no_show_count: number;
  fraud_penalty_count: number;
  composite_score: number; // 0 to 100
  createdAt: Date;
  updatedAt: Date;
}

const providerScoreSchema = new Schema<IProviderScore>(
  {
    provider_id: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
    acceptance_rate: { type: Number, default: 95 },
    cancellation_rate: { type: Number, default: 2 },
    late_arrival_rate: { type: Number, default: 3 },
    response_time_sec: { type: Number, default: 25 },
    no_show_count: { type: Number, default: 0 },
    fraud_penalty_count: { type: Number, default: 0 },
    composite_score: { type: Number, default: 85, index: true },
  },
  { timestamps: true }
);

export const ProviderScore = mongoose.model<IProviderScore>('ProviderScore', providerScoreSchema);
