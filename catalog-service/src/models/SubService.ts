import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISubService extends Document {
  service_id: Types.ObjectId;
  subservice_name: string;
  description: string;
  base_price: number;
  duration: number;
  variants: {
    name: string;
    price: number;
    duration: number;
  }[];
  image: string;
  status: 'active' | 'inactive';
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const subServiceSchema = new Schema<ISubService>(
  {
    service_id: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    subservice_name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    base_price: {
      type: Number,
      required: true,
      min: 0,
    },
    duration: {
      type: Number,
      required: true,
      min: 1,
    },
    variants: [
      {
        name: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
        duration: { type: Number, required: true, min: 1 },
      },
    ],
    image: {
      type: String,
      required: false,
      trim: true,
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

subServiceSchema.index({ service_id: 1, isDeleted: 1 });

export const SubService = mongoose.model<ISubService>('SubService', subServiceSchema);
