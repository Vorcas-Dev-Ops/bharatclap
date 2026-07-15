import mongoose, { Schema, Document } from 'mongoose';

export interface IBookingActivity extends Document {
  booking_id: mongoose.Types.ObjectId;
  action: string;
  actor: 'customer' | 'provider' | 'admin' | 'system';
  actor_id?: string;
  details: any;
  timestamp: Date;
}

const bookingActivitySchema = new Schema<IBookingActivity>(
  {
    booking_id: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    actor: {
      type: String,
      enum: ['customer', 'provider', 'admin', 'system'],
      required: true,
    },
    actor_id: {
      type: String,
      required: false,
    },
    details: {
      type: Schema.Types.Mixed,
      required: false,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const BookingActivity = mongoose.model<IBookingActivity>('BookingActivity', bookingActivitySchema);
