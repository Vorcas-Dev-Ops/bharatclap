import mongoose, { Document, Schema } from 'mongoose';

export interface IUserMembership extends Document {
  user_id: mongoose.Types.ObjectId;
  membership_id: mongoose.Types.ObjectId;
  purchase_date: Date;
  expiry_date: Date;
  payment_status: 'pending' | 'paid' | 'failed';
  membership_status: 'active' | 'expired' | 'cancelled';
  services_used: number;
  remaining_benefits: number;
  priority_bookings_used: number;
  coupon_usage_count: number;
  expiring_soon_reminder_sent?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userMembershipSchema = new Schema<IUserMembership>(
  {
    user_id: { type: Schema.Types.ObjectId, required: true, index: true },
    membership_id: { type: Schema.Types.ObjectId, required: true },
    purchase_date: { type: Date, default: Date.now },
    expiry_date: { type: Date, required: true },
    payment_status: { 
      type: String, 
      enum: ['pending', 'paid', 'failed'], 
      default: 'paid' 
    },
    membership_status: { 
      type: String, 
      enum: ['active', 'expired', 'cancelled'], 
      default: 'active' 
    },
    services_used: { type: Number, default: 0 },
    remaining_benefits: { type: Number, default: 0 },
    priority_bookings_used: { type: Number, default: 0 },
    coupon_usage_count: { type: Number, default: 0 },
    expiring_soon_reminder_sent: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Compound index for the hot "get active membership by user" query path
userMembershipSchema.index({ user_id: 1, membership_status: 1 });
// Compound index for the stats endpoint 30-day range filter
userMembershipSchema.index({ payment_status: 1, purchase_date: 1 });
// Single-field index for expiry-based range lookups and future TTL queries
userMembershipSchema.index({ expiry_date: 1 });

export const UserMembership = mongoose.model<IUserMembership>('UserMembership', userMembershipSchema);
