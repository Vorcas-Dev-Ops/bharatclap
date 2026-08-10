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
  currentGlobalUsage: number; // Global usage tracking counter
  totalBudget: number; // Campaign spending budget
  currentBudgetSpent: number; // Tracked campaign spends
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
  isFirstOrderOnly: boolean; // Flag to easily target first orders
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
    usageLimit: { type: Number, default: 99999 },
    perUserLimit: { type: Number, default: 1 },
    currentGlobalUsage: { type: Number, default: 0 },
    totalBudget: { type: Number, required: true, default: 100000 },
    currentBudgetSpent: { type: Number, default: 0 },
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
    }],
    isFirstOrderOnly: { type: Boolean, default: false }
  },
  { timestamps: true }
);

couponSchema.index({ code: 1, status: 1 });
couponSchema.index({ expiryDate: 1 });

// Soft delete query filter hook
couponSchema.pre(/^find/, function(this: any) {
  if (!this.getOptions()?.includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

export const Coupon = mongoose.model<ICoupon>('Coupon', couponSchema);
