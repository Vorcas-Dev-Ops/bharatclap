import mongoose, { Document, Schema } from 'mongoose';

export interface ICategory extends Document {
  category_name: string;
  code?: string;
  codeLocked?: boolean;
  slug: string;
  icon: string;
  description: string;
  requiresGenderSelection: boolean;
  status: 'active' | 'inactive';
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    category_name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    code: {
      type: String,
      required: false,
      uppercase: true,
      trim: true,
      sparse: true,
      match: /^[A-Z]{3,5}$/,
    },
    codeLocked: {
      type: Boolean,
      default: false,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    icon: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    requiresGenderSelection: {
      type: Boolean,
      default: false,
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

export const Category = mongoose.model<ICategory>('Category', categorySchema);
