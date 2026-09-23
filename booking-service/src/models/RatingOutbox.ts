import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRatingOutbox extends Document {
  review_id: Types.ObjectId | string;
  provider_id: Types.ObjectId | string;
  rating: number;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  attempts: number;
  last_attempted_at?: Date;
  error_message?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ratingOutboxSchema = new Schema<IRatingOutbox>(
  {
    review_id: { type: Schema.Types.Mixed, required: true, unique: true, index: true },
    provider_id: { type: Schema.Types.Mixed, required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    last_attempted_at: { type: Date },
    error_message: { type: String },
  },
  { timestamps: true }
);

ratingOutboxSchema.index({ status: 1, attempts: 1 });

export const RatingOutbox = mongoose.model<IRatingOutbox>('RatingOutbox', ratingOutboxSchema);
