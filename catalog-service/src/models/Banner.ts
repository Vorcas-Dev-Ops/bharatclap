import mongoose, { Document, Schema } from 'mongoose';

export interface IBanner extends Document {
  title: string;
  subtitle?: string;
  image_url: string;
  redirect_type: 'category' | 'service' | 'url' | 'none';
  redirect_id?: string;
  redirect_url?: string;
  button_text?: string;
  display_order: number;
  status: 'active' | 'inactive';
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const bannerSchema = new Schema<IBanner>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
    },
    image_url: {
      type: String,
      required: true,
      trim: true,
    },
    redirect_type: {
      type: String,
      enum: ['category', 'service', 'url', 'none'],
      default: 'none',
    },
    redirect_id: {
      type: String,
      trim: true,
    },
    redirect_url: {
      type: String,
      trim: true,
    },
    button_text: {
      type: String,
      trim: true,
    },
    display_order: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Banner = mongoose.model<IBanner>('Banner', bannerSchema);
