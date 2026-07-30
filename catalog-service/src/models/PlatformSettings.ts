import mongoose, { Document, Schema } from 'mongoose';

export interface IPlatformSettings extends Document {
  platform_name: string;
  support_email: string;
  platform_logo: string;
  support_phone: string;
  updatedAt: Date;
}

const settingsSchema = new Schema<IPlatformSettings>(
  {
    platform_name: {
      type: String,
      required: true,
      default: 'BharatClap',
    },
    support_email: {
      type: String,
      required: true,
      default: 'support@bharatclap.com',
    },
    platform_logo: {
      type: String,
      default: '',
    },
    support_phone: {
      type: String,
      default: '+91 9876543210',
    },
  },
  { timestamps: true }
);

export const PlatformSettings = mongoose.model<IPlatformSettings>('PlatformSettings', settingsSchema);
