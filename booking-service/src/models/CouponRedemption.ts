import mongoose, { Schema, Document } from 'mongoose';

export interface ICouponRedemption extends Document {
  couponId: mongoose.Types.ObjectId;
  couponCode: string;
  userId: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;
  discountApplied: number;
  status: 'locked' | 'consumed' | 'released';
  idempotencyKey?: string;
}

const couponRedemptionSchema = new Schema<ICouponRedemption>(
  {
    couponId: { type: Schema.Types.ObjectId, required: true },
    couponCode: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    bookingId: { type: Schema.Types.ObjectId, required: true, unique: true },
    discountApplied: { type: Number, required: true },
    status: { type: String, enum: ['locked', 'consumed', 'released'], default: 'locked', required: true },
    idempotencyKey: { type: String }
  },
  { timestamps: true }
);

// CRITICAL UNIQUE LOCK INDEXES:
// 1. Prevents two parallel checkout requests from acquiring a 'locked' status for the same coupon and user concurrently.
couponRedemptionSchema.index({ couponId: 1, userId: 1, status: 1 }, { 
  unique: true,
  partialFilterExpression: { status: 'locked' } // Only enforce uniqueness on active locks
});

// 2. Prevent duplicate checkout retries from double-applying coupons
couponRedemptionSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export const CouponRedemption = mongoose.model<ICouponRedemption>('CouponRedemption', couponRedemptionSchema);
