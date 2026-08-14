import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPendingPhoneChange extends Document {
  user_id: Types.ObjectId;
  new_phone: string;
  otp_hash: string;
  expires_at: Date;
  attempts: number;
  status: 'pending' | 'expired';
  created_at: Date;
}

const pendingPhoneChangeSchema = new Schema<IPendingPhoneChange>(
  {
    user_id: { type: Schema.Types.ObjectId, required: true },
    new_phone: { type: String, required: true },
    otp_hash: { type: String, required: true },
    expires_at: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'expired'], default: 'pending' },
    created_at: { type: Date, default: Date.now, index: { expires: 3600 } }, // ponytail: 1-hour TTL cleanup for stale/expired records
  },
  { timestamps: false }
);

pendingPhoneChangeSchema.index({ user_id: 1, status: 1 });

export const PendingPhoneChange = mongoose.model<IPendingPhoneChange>('PendingPhoneChange', pendingPhoneChangeSchema);
