import mongoose, { Document, Schema, Types } from 'mongoose';

// ponytail: 90-day retention for rate-limit enforcement and audit. Not a permanent record — TTL'd.
export interface IPhoneChangeHistory extends Document {
  user_id: Types.ObjectId;
  old_phone_hash: string;
  new_phone_hash: string;
  changed_at: Date;
}

const phoneChangeHistorySchema = new Schema<IPhoneChangeHistory>(
  {
    user_id: { type: Schema.Types.ObjectId, required: true },
    old_phone_hash: { type: String, required: true },
    new_phone_hash: { type: String, required: true },
    changed_at: { type: Date, default: Date.now, index: { expires: 7776000 } }, // ponytail: 90-day TTL — long enough for any audit window, bump if retention policy requires more
  },
  { timestamps: false }
);

phoneChangeHistorySchema.index({ user_id: 1, changed_at: -1 });

export const PhoneChangeHistory = mongoose.model<IPhoneChangeHistory>('PhoneChangeHistory', phoneChangeHistorySchema);
