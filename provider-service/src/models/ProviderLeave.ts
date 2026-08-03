import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProviderLeave extends Document {
  provider_id: Types.ObjectId;
  leave_type: 'vacation' | 'medical' | 'festival' | 'personal';
  start_date: Date;
  end_date: Date;
  reason?: string;
  status: 'active' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const providerLeaveSchema = new Schema<IProviderLeave>(
  {
    provider_id: { type: Schema.Types.ObjectId, required: true, index: true },
    leave_type: { type: String, enum: ['vacation', 'medical', 'festival', 'personal'], default: 'vacation' },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    reason: { type: String },
    status: { type: String, enum: ['active', 'cancelled'], default: 'active' },
  },
  { timestamps: true }
);

providerLeaveSchema.index({ provider_id: 1, start_date: 1, end_date: 1, status: 1 });

export const ProviderLeave = mongoose.model<IProviderLeave>('ProviderLeave', providerLeaveSchema);
