import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomerReferral extends Document {
  referrerId: mongoose.Types.ObjectId;
  refereeId: mongoose.Types.ObjectId;
  referralCodeUsed: string;
  status: 'invited' | 'booked' | 'completed' | 'rewarded' | 'flagged';
  ipAddress?: string;
  deviceFingerprint?: string;
  refereePhone: string;
  referrerPhone: string;
  createdAt: Date;
}

const customerReferralSchema = new Schema<ICustomerReferral>(
  {
    referrerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    refereeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    referralCodeUsed: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['invited', 'booked', 'completed', 'rewarded', 'flagged'], 
      default: 'invited' 
    },
    ipAddress: { type: String },
    deviceFingerprint: { type: String },
    refereePhone: { type: String, required: true },
    referrerPhone: { type: String, required: true }
  },
  { timestamps: true }
);

customerReferralSchema.index({ referrerId: 1, status: 1 });
customerReferralSchema.index({ refereePhone: 1 }, { unique: true });

export const CustomerReferral = mongoose.model<ICustomerReferral>('CustomerReferral', customerReferralSchema);
