import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProviderCounter extends Document {
  categoryId: Types.ObjectId;
  categoryCode: string;
  seq: number;
}

const providerCounterSchema = new Schema<IProviderCounter>(
  {
    categoryCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      required: false,
    },
    seq: {
      type: Number,
      default: 0,
      required: true,
    },
  },
  { timestamps: true }
);

export const ProviderCounter = mongoose.model<IProviderCounter>('ProviderCounter', providerCounterSchema);
