import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICategoryDispatchRule extends Document {
  category_id?: Types.ObjectId;
  categoryName: string;
  maxJobsPerDay: number;
  maxConcurrentJobs: number;
  isEmergencyEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categoryDispatchRuleSchema = new Schema<ICategoryDispatchRule>(
  {
    category_id: { type: Schema.Types.ObjectId, required: false },
    categoryName: { type: String, required: true },
    maxJobsPerDay: { type: Number, default: 15 },
    maxConcurrentJobs: { type: Number, default: 3 },
    isEmergencyEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const CategoryDispatchRule = mongoose.model<ICategoryDispatchRule>('CategoryDispatchRule', categoryDispatchRuleSchema);

// Safely drop legacy unique index if it exists to avoid E11000 duplicate key errors on null category_id
CategoryDispatchRule.collection.dropIndex('category_id_1').catch(() => {});
