import mongoose, { Schema, Document } from 'mongoose';

export interface ICouponUsage extends Document {
  couponId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;
  discountApplied: number;
  usedAt: Date;
}

const couponUsageSchema = new Schema<ICouponUsage>(
  {
    couponId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    bookingId: { type: Schema.Types.ObjectId, required: true },
    discountApplied: { type: Number, required: true },
    usedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const CouponUsage = mongoose.model<ICouponUsage>('CouponUsage', couponUsageSchema);
