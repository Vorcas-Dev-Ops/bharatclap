import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IService extends Document {
  category_id: Types.ObjectId;
  service_name: string;
  slug: string;
  description: string;
  base_price: number;
  duration: number;
  images: string[];
  is_featured: boolean;
  avg_rating: number;
  total_reviews: number;
  genderApplicability: 'men' | 'women';
  status: 'active' | 'inactive';
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<IService>(
  {
    category_id: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    service_name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
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
    images: [
      {
        type: String,
        required: false,
        trim: true,
      },
    ],
    is_featured: {
      type: Boolean,
      default: false,
    },
    avg_rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    total_reviews: {
      type: Number,
      default: 0,
    },
    genderApplicability: {
      type: String,
      enum: ['men', 'women'],
      default: 'men',
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

serviceSchema.index({ category_id: 1, isDeleted: 1 });
serviceSchema.index({ category_id: 1, status: 1, isDeleted: 1 });

// Soft delete query filter hook
serviceSchema.pre(/^find/, function(this: any) {
  if (!this.getOptions()?.includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

export const Service = mongoose.model<IService>('Service', serviceSchema);
