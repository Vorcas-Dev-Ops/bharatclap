import mongoose, { Document, Schema, Types } from 'mongoose';

export type CalendarBlockType = 
  | 'travel' 
  | 'booking' 
  | 'cleanup' 
  | 'break' 
  | 'leave' 
  | 'meeting' 
  | 'training' 
  | 'maintenance' 
  | 'manual_block';

export interface IProviderCalendarBlock extends Document {
  provider_id: Types.ObjectId;
  booking_id?: Types.ObjectId;
  block_type: CalendarBlockType;
  start_time: Date;
  end_time: Date;
  status: 'reserved' | 'confirmed' | 'cancelled';
  location?: {
    type: string;
    coordinates: [number, number];
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const providerCalendarBlockSchema = new Schema<IProviderCalendarBlock>(
  {
    provider_id: { type: Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    booking_id: { type: Schema.Types.ObjectId, ref: 'Booking', index: true },
    block_type: { 
      type: String, 
      enum: ['travel', 'booking', 'cleanup', 'break', 'leave', 'meeting', 'training', 'maintenance', 'manual_block'], 
      required: true 
    },
    start_time: { type: Date, required: true, index: true },
    end_time: { type: Date, required: true, index: true },
    status: { type: String, enum: ['reserved', 'confirmed', 'cancelled'], default: 'confirmed', index: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }
    },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

// ponytail: compound index for O(log N) overlapping interval queries
providerCalendarBlockSchema.index({ provider_id: 1, status: 1, start_time: 1, end_time: 1 });

export const ProviderCalendarBlock = mongoose.model<IProviderCalendarBlock>(
  'ProviderCalendarBlock',
  providerCalendarBlockSchema
);
