import mongoose, { Document, Schema } from 'mongoose';

export interface IPincodeCache extends Document {
  pincode: string;
  lat: number;
  lng: number;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

const pincodeCacheSchema = new Schema<IPincodeCache>(
  {
    pincode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    lat: {
      type: Number,
      required: true,
    },
    lng: {
      type: Number,
      required: true,
    },
    displayName: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Optional: Expire cached entries after 30 days so we pick up changes periodically
// pincodeCacheSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const PincodeCache = mongoose.model<IPincodeCache>('PincodeCache', pincodeCacheSchema);
