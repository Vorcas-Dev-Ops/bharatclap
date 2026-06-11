import mongoose, { Document, Schema } from 'mongoose';

export interface IPlatformSettings extends Document {
  platform_name: string;
  support_email: string;
  updatedAt: Date;
}

const settingsSchema = new Schema<IPlatformSettings>(
  {
    platform_name: {
      type: String,
      required: true,
      default: 'FIXVO',
    },
    support_email: {
      type: String,
      required: true,
      default: 'support@fixvo.com',
    },
  },
  { timestamps: true }
);

export const PlatformSettings = mongoose.model<IPlatformSettings>('PlatformSettings', settingsSchema);
