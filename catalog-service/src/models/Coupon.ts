import mongoose, { Schema, Document } from 'mongoose';

export interface ICoupon extends Document {
  name: string;
  code: string;
  description: string;
  discountType: 'flat' | 'percentage' | 'cashback';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountLimit: number;
  usageLimit: number;
  perUserLimit: number;
  autoApply: boolean;
  isFeatured: boolean;
  badgeLabel?: string;
  highlightGradient?: string;
  startDate: Date;
  expiryDate: Date;
  status: 'active' | 'inactive' | 'expired';
  allowedServices: mongoose.Types.ObjectId[];
  allowedCategories: mongoose.Types.ObjectId[];
  allowedMemberships: mongoose.Types.ObjectId[];
  targetAudience: ('all' | 'members' | 'first_time')[];
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<ICoupon>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, required: true },
    discountType: { 
      type: String, 
      enum: ['flat', 'percentage', 'cashback'], 
      required: true 
    },
    discountValue: { type: Number, required: true },
    minOrderAmount: { type: Number, default: 0 },
    maxDiscountLimit: { type: Number, default: 0 },
    usageLimit: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1 },
    autoApply: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    badgeLabel: { type: String },
    highlightGradient: { type: String },
    startDate: { type: Date, default: Date.now },
    expiryDate: { type: Date, required: true },
    status: { 
      type: String, 
      enum: ['active', 'inactive', 'expired'], 
      default: 'active' 
    },
    allowedServices: [{ type: Schema.Types.ObjectId, ref: 'Service' }],
    allowedCategories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    allowedMemberships: [{ type: Schema.Types.ObjectId, ref: 'Membership' }],
    targetAudience: [{ 
      type: String, 
      enum: ['all', 'members', 'first_time'],
      default: ['all']
    }]
  },
  { timestamps: true }
);

export const Coupon = mongoose.model<ICoupon>('Coupon', couponSchema);
