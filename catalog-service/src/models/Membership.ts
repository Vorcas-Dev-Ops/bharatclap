import mongoose, { Document, Schema } from 'mongoose';

export interface IMembership extends Document {
  name: string;
  description: string;
  price: number;
  duration: 'monthly' | 'quarterly' | 'yearly';
  discountPercentage: number;
  
  features: string[]; // Keep for display
  benefits: string[]; // Keep for display
  
  role: 'user' | 'provider';
  
  userConfig?: {
    priorityBooking: boolean;
    bookingLimit: number;
    freeReschedule: boolean;
    couponLimit: number;
    exclusiveCoupons: boolean;
    refundPriority: boolean;
    refundProcessingDays: number;
    cancellationDiscountPercentage: number;
    cashbackPercentage: number;
    prioritySupport: boolean;
    preferredVerifiedProviders: boolean;
    freeCancellation: boolean;
  };

  providerConfig?: {
    featuredListing: boolean;
    boostVisibility: boolean;
    priorityLeadAccess: boolean;
    unlimitedBookings: boolean;
    monthlyLeadLimit: number;
    analyticsDashboard: boolean;
    dedicatedAccountManager: boolean;
    premiumBadge: boolean;
    priorityDispatch: boolean;
    commissionPercentage: number;
  };

  badgeLabel?: string;
  cardHighlightColor?: string;
  isPopular: boolean;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const membershipSchema = new Schema<IMembership>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    duration: { 
      type: String, 
      enum: ['monthly', 'quarterly', 'yearly'], 
      required: true 
    },
    discountPercentage: { type: Number, default: 0 },
    features: [{ type: String }],
    benefits: [{ type: String }],
    role: { type: String, enum: ['user', 'provider'], default: 'user' },
    
    userConfig: {
      priorityBooking: { type: Boolean, default: false },
      bookingLimit: { type: Number, default: 10 },
      freeReschedule: { type: Boolean, default: false },
      couponLimit: { type: Number, default: 2 },
      exclusiveCoupons: { type: Boolean, default: false },
      refundPriority: { type: Boolean, default: false },
      refundProcessingDays: { type: Number, default: 7 },
      cancellationDiscountPercentage: { type: Number, default: 0 },
      cashbackPercentage: { type: Number, default: 0 },
      prioritySupport: { type: Boolean, default: false },
      preferredVerifiedProviders: { type: Boolean, default: false },
      freeCancellation: { type: Boolean, default: false }
    },
    
    providerConfig: {
      featuredListing: { type: Boolean, default: false },
      boostVisibility: { type: Boolean, default: false },
      priorityLeadAccess: { type: Boolean, default: false },
      unlimitedBookings: { type: Boolean, default: false },
      monthlyLeadLimit: { type: Number, default: 50 },
      analyticsDashboard: { type: Boolean, default: false },
      dedicatedAccountManager: { type: Boolean, default: false },
      premiumBadge: { type: Boolean, default: false },
      priorityDispatch: { type: Boolean, default: false },
      commissionPercentage: { type: Number, default: 15 }
    },

    badgeLabel: { type: String },
    cardHighlightColor: { type: String, default: '#2563EB' },
    isPopular: { type: Boolean, default: false },
    status: { 
      type: String, 
      enum: ['active', 'inactive'], 
      default: 'active' 
    }
  },
  { timestamps: true }
);

export const Membership = mongoose.model<IMembership>('Membership', membershipSchema);
