import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IWalletOutbox extends Document {
  provider_id: Types.ObjectId;
  event_type: string;
  payload: any;
  status: 'pending' | 'published' | 'failed';
  retry_count: number;
  trace_id?: string;
  correlation_id?: string;
  published_at?: Date;
  error_message?: string;
  createdAt: Date;
  updatedAt: Date;
}

const walletOutboxSchema = new Schema<IWalletOutbox>(
  {
    provider_id: { type: Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    event_type: { type: String, required: true, default: 'wallet_updated', index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ['pending', 'published', 'failed'],
      default: 'pending',
      index: true
    },
    retry_count: { type: Number, default: 0 },
    trace_id: { type: String },
    correlation_id: { type: String },
    published_at: { type: Date },
    error_message: { type: String }
  },
  { timestamps: true }
);

walletOutboxSchema.index({ status: 1, createdAt: 1 });

export const WalletOutbox = mongoose.model<IWalletOutbox>('WalletOutbox', walletOutboxSchema);
