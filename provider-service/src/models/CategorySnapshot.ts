import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICategorySnapshot extends Document {
  categoryId: Types.ObjectId;
  categoryCode: string;
  categoryName: string;
  codeLocked: boolean;
  updatedAt: Date;
}

const categorySnapshotSchema = new Schema<ICategorySnapshot>(
  {
    categoryId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },
    categoryCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    categoryName: {
      type: String,
      required: true,
      trim: true,
    },
    codeLocked: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const CategorySnapshot = mongoose.model<ICategorySnapshot>('CategorySnapshot', categorySnapshotSchema);
