import mongoose, { Document, Schema } from 'mongoose';

export interface ISlotCapacity extends Document {
  city: string;
  date: string; // YYYY-MM-DD
  booking_time: string; // e.g. "10:00 AM"
  max_capacity: number;
  booked_count: number;
  createdAt: Date;
  updatedAt: Date;
}

const slotCapacitySchema = new Schema<ISlotCapacity>(
  {
    city: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    booking_time: { type: String, required: true },
    max_capacity: { type: Number, default: 40 },
    booked_count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

slotCapacitySchema.index({ city: 1, date: 1, booking_time: 1 }, { unique: true });

export const SlotCapacity = mongoose.model<ISlotCapacity>('SlotCapacity', slotCapacitySchema);
