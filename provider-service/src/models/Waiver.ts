import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IWaiver extends Document {
  providerId: Types.ObjectId;
  providerName: string;
  waiverType: 'full' | 'partial';
  amount: number;
  reason: string;
  grantedBy?: Types.ObjectId;
  status: 'active' | 'used' | 'revoked';
}

const waiverSchema = new Schema<IWaiver>({
  providerId: { type: Schema.Types.ObjectId, required: true },
  providerName: { type: String, required: true },
  waiverType: { type: String, enum: ['full', 'partial'], required: true },
  amount: { type: Number, required: true },
  reason: { type: String, required: true },
  grantedBy: { type: Schema.Types.ObjectId },
  status: { type: String, enum: ['active', 'used', 'revoked'], default: 'active' },
}, { timestamps: true });

export const Waiver = mongoose.model<IWaiver>('Waiver', waiverSchema);
