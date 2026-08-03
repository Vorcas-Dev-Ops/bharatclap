import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProviderCounter extends Document {
  categoryId: Types.ObjectId;
  categoryCode: string;
  seq: number;
}

const providerCounterSchema = new Schema<IProviderCounter>(
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
    seq: {
      type: Number,
      default: 0,
      required: true,
    },
  },
  { timestamps: true }
);

providerCounterSchema.index({ categoryId: 1, seq: 1 }, { unique: true });

export const ProviderCounter = mongoose.model<IProviderCounter>('ProviderCounter', providerCounterSchema);
