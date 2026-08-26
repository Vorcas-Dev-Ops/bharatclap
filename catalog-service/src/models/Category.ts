import mongoose, { Document, Schema } from 'mongoose';

export interface ICategory extends Document {
  category_id?: string;
  name: string;
  category_name?: string;
  code?: string;
  codeLocked?: boolean;
  slug?: string;
  icon?: string;
  image?: string;
  public_id?: string;
  resource_type?: string;
  description?: string;
  requiresGenderSelection?: boolean;
  status: 'active' | 'inactive';
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    category_id: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    category_name: {
      type: String,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
    },
    codeLocked: {
      type: Boolean,
      default: false,
    },
    slug: {
      type: String,
      trim: true,
    },
    icon: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      trim: true,
    },
    public_id: {
      type: String,
      trim: true,
    },
    resource_type: {
      type: String,
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

// Soft delete query filter hook
categorySchema.pre(/^find/, function(this: any) {
  if (!this.getOptions()?.includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

// home-bundle query: isDeleted filter + createdAt sort
categorySchema.index({ isDeleted: 1, createdAt: -1 });

export const Category = mongoose.model<ICategory>('Category', categorySchema);
