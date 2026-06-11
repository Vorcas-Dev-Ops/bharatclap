import mongoose, { Document, Schema } from 'mongoose';

export interface ICommission extends Document {
  category_name: string;      // "All Categories" or a specific category name
  rate: number;               // percentage e.g. 15
  status: 'active' | 'inactive';
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const commissionSchema = new Schema<ICommission>(
  {
    category_name: {
      type: String,
      required: true,
      trim: true,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const Commission = mongoose.model<ICommission>('Commission', commissionSchema);
