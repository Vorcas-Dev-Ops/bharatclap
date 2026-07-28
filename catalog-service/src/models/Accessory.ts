import mongoose, { Document, Schema } from 'mongoose';

export interface IAccessory extends Document {
  title: string;
  description: string;
  price: number;
  gst_percent: number;
  image: string;
  stock: number;
  category: mongoose.Types.ObjectId;
  status: 'active' | 'inactive';
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const accessorySchema = new Schema<IAccessory>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    gst_percent: {
      type: Number,
      required: true,
      default: 18,
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
    },
    image: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

accessorySchema.index({ isDeleted: 1, category: 1, status: 1 });
accessorySchema.index({ isDeleted: 1, createdAt: -1 });

export const Accessory = mongoose.model<IAccessory>('Accessory', accessorySchema);
