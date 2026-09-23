import mongoose, { Document, Schema } from 'mongoose';

export interface IOtp extends Document {
  identifier: string;
  purpose: 'LOGIN_REGISTRATION' | 'PHONE_CHANGE' | 'PASSWORD_RESET' | 'ACCOUNT_DELETION' | string;
  otpCode?: string;
  otpHash?: string;
  role: string;
  status: 'active' | 'consumed' | 'locked';
  attempts: number;
  consumedAt?: Date;
  lockedAt?: Date;
  createdAt: Date;
}

const otpSchema = new Schema<IOtp>({
  identifier: { 
    type: String, 
    required: true,
    index: true 
  },
  purpose: {
    type: String,
    enum: ['LOGIN_REGISTRATION', 'PHONE_CHANGE', 'PASSWORD_RESET', 'ACCOUNT_DELETION'],
    default: 'LOGIN_REGISTRATION',
    required: true,
  },
  otpCode: { 
    type: String,
  },
  otpHash: {
    type: String,
  },
  role: { 
    type: String, 
    required: true,
    default: 'customer'
  },
  status: {
    type: String,
    enum: ['active', 'consumed', 'locked'],
    default: 'active',
    index: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  consumedAt: {
    type: Date,
  },
  createdAt: { 
    type: Date, 
    default: Date.now, 
    expires: 300 // Automatically deletes the document after 5 minutes (300 seconds)
  }
});

otpSchema.index({ identifier: 1, purpose: 1 }, { unique: true });

export const Otp = mongoose.model<IOtp>('Otp', otpSchema);
