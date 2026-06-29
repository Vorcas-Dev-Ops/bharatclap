import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  phone: string;
  password?: string;
  role: 'admin' | 'customer' | 'provider';
  profile_image?: string;
  status: 'active' | 'blocked';
  gender?: string;
  isDeleted: boolean;
  lastLogin?: Date;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
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
          return /^\+?[1-9]\d{1,14}$/.test(v);
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
  },
  {
    timestamps: true,
  }
);

userSchema.index({ role: 1, isDeleted: 1 });
userSchema.index({ isDeleted: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ status: 1, isDeleted: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
