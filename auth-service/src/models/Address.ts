import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAddress extends Document {
  user_id: Types.ObjectId;

  // Granular fields (new)
  address_label: 'Home' | 'Office' | 'Other';
  house_name: string;        // House Name / Flat Number (required)
  building_name?: string;    // Building / Apartment (optional)
  street?: string;           // Street / Road (optional)
  landmark?: string;         // Landmark (optional)
  area: string;              // Area / Locality (required)
  city: string;              // City (required)
  state: string;             // State (required)
  pincode: string;           // Pincode (required)

  // Coordinates
  latitude?: number;
  longitude?: number;
  coordinates?: {
    type: 'Point';
    coordinates: [number, number];
  };

  is_default: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Virtual (backward compat)
  address_line: string;
}

const addressSchema = new Schema<IAddress>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    address_label: {
      type: String,
      enum: ['Home', 'Office', 'Other'],
      default: 'Home',
    },
    house_name: {
      type: String,
      required: true,
      trim: true,
    },
    building_name: {
      type: String,
      trim: true,
    },
    street: {
      type: String,
      trim: true,
    },
    landmark: {
      type: String,
      trim: true,
    },
    area: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
    },
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        index: '2dsphere',
      },
    },
    is_default: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: address_line — backward-compatible computed display string
addressSchema.virtual('address_line').get(function (this: IAddress) {
  const parts = [
    this.house_name,
    this.building_name,
    this.street,
    this.area,
  ].filter(Boolean);
  return parts.join(', ');
});

export const Address = mongoose.model<IAddress>('Address', addressSchema);
