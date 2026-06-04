import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILocation extends Document {
  name: string;
  type: string;
  parent_id?: Types.ObjectId | null;
  pincode?: string;
  coordinates?: {
    type: 'Point';
    coordinates: [number, number];
  };
  status: 'active' | 'inactive';
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const locationSchema = new Schema<ILocation>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
    },
    parent_id: {
      type: Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
    pincode: {
      type: String,
      trim: true,
    },
    coordinates: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

locationSchema.index({ coordinates: '2dsphere' });

export const Location = mongoose.model<ILocation>('Location', locationSchema);
