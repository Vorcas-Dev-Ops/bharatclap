import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  phone: string;
  password?: string;
  role: 'admin' | 'customer' | 'provider';
  admin_role?: 'super_admin' | 'operations_admin' | 'support_admin' | 'finance_admin';
  profile_image?: string;
  status: 'active' | 'blocked';
  gender?: string;
  isDeleted: boolean;
  lastLogin?: Date;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  tokenVersion: number;
  googleId?: string;
  authProvider?: 'local' | 'google';
  referralCode?: string; // Unique customer referral code
  walletBalance: number; // Customer promotional wallet credit
  deletion_requested_at?: Date;
  deletion_scheduled_at?: Date;
  is_anonymized?: boolean;
  consent_given_at?: Date;
  consent_version?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: false,
      trim: true,
    },
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
      validate: {
        validator: function(v: string) {
          if (!v) return true;
          const clean = v.replace(/\D/g, "");
          return clean.length >= 10 && clean.length <= 15;
        },
        message: (props: any) => `${props.value} is not a valid phone number!`
      }
    },
    password: {
      type: String,
      required: false,
    },
    role: {
      type: String,
      enum: ['admin', 'customer', 'provider'],
      default: 'customer',
      required: true,
    },
    profile_image: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'blocked'],
      default: 'active',
    },
    gender: {
      type: String,
      required: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    googleId: {
      type: String,
      required: false,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    admin_role: {
      type: String,
      enum: ['super_admin', 'operations_admin', 'support_admin', 'finance_admin'],
      default: 'support_admin',
    },
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true
    },
    walletBalance: {
      type: Number,
      default: 0
    },
    deletion_requested_at: {
      type: Date
    },
    deletion_scheduled_at: {
      type: Date
    },
    is_anonymized: {
      type: Boolean,
      default: false
    },
    consent_given_at: {
      type: Date
    },
    consent_version: {
      type: String,
      default: 'v1.0'
    }
  },
  {
    timestamps: true,
  }
);

userSchema.index({ role: 1, isDeleted: 1 });
userSchema.index({ isDeleted: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ status: 1, isDeleted: 1 });
userSchema.index({ role: 1, status: 1, isDeleted: 1, createdAt: -1 });
userSchema.index({ referralCode: 1 }, { unique: true, sparse: true });
userSchema.index({ deletion_scheduled_at: 1, is_anonymized: 1 });

// Soft delete query filter hook
userSchema.pre(/^find/, function(this: any) {
  if (!this.getOptions()?.includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

export const User = mongoose.model<IUser>('User', userSchema);
