import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IReview extends Document {
  booking_id: Types.ObjectId;
  user_id: Types.ObjectId;
  provider_id: Types.ObjectId;
  service_id: Types.ObjectId;
  subservice_id: Types.ObjectId;
  rating: number; // 1-5
  comment: string;

  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    booking_id: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true, // One review per booking
    },
    user_id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    provider_id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    service_id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    subservice_id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

reviewSchema.index({ provider_id: 1 });
reviewSchema.index({ user_id: 1 });

export const Review = mongoose.model<IReview>('Review', reviewSchema);
