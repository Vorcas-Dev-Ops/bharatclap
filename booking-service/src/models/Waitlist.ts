import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IWaitlist extends Document {
  user_id: Types.ObjectId;
  city: string;
  subservice_id?: Types.ObjectId;
  date: string;
  booking_time: string;
  status: 'pending' | 'notified' | 'cancelled' | 'converted';
  createdAt: Date;
  updatedAt: Date;
}

const waitlistSchema = new Schema<IWaitlist>(
  {
    user_id: { type: Schema.Types.ObjectId, required: true, index: true },
    city: { type: String, required: true },
    subservice_id: { type: Schema.Types.ObjectId },
    date: { type: String, required: true },
    booking_time: { type: String, required: true },
    status: { type: String, enum: ['pending', 'notified', 'cancelled', 'converted'], default: 'pending' },
  },
  { timestamps: true }
);

waitlistSchema.index({ city: 1, date: 1, booking_time: 1, status: 1 });

export const Waitlist = mongoose.model<IWaitlist>('Waitlist', waitlistSchema);
