import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAddress extends Document {
  user_id: Types.ObjectId;
  
  // User Editable
  address_type: 'Home' | 'Work' | 'Other';
  label?: string;
  house_no_building: string;
  address_line_1: string;
  address_line_2?: string;
  address_line_3?: string;
  area_locality: string;
  landmark?: string;
  city: string;
  district: string;
  state: string;
  country: string;
  pincode: string;
  delivery_notes?: string;

  // Map Information
  latitude: number;
  longitude: number;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  formatted_address: string;
  place_id?: string;
  map_provider?: string;
  is_verified: boolean;

  // System
  is_default: boolean;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Virtuals
  address_line: string;
  short_address: string;
}

const addressSchema = new Schema<IAddress>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    
    address_type: { type: String, enum: ['Home', 'Work', 'Other'], required: true, default: 'Home' },
    label: { type: String, trim: true },
    house_no_building: { type: String, required: true, trim: true },
    address_line_1: { type: String, required: true, trim: true },
    address_line_2: { type: String, trim: true },
    address_line_3: { type: String, trim: true },
    area_locality: { type: String, required: true, trim: true },
    landmark: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: 'India' },
    pincode: { type: String, required: true, trim: true },
    delivery_notes: { type: String, trim: true },

    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point', required: true },
      coordinates: { type: [Number], required: true }, // [longitude, latitude]
    },
    formatted_address: { type: String, required: true },
    place_id: { type: String },
    map_provider: { type: String },
    is_verified: { type: Boolean, required: true, default: false },

    is_default: { type: Boolean, required: true, default: false },
    status: { type: Boolean, required: true, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

addressSchema.index({ location: '2dsphere' });

// Virtuals
addressSchema.virtual('address_line').get(function (this: IAddress) {
  const parts = [
    this.house_no_building,
    this.address_line_1,
    this.address_line_2,
    this.address_line_3,
    this.area_locality,
    this.city,
    this.district,
    this.state,
    `${this.country} - ${this.pincode}`
  ].filter(Boolean);
  return parts.join(', ');
});

addressSchema.virtual('short_address').get(function (this: IAddress) {
  const parts = [
    this.address_line_1 || this.house_no_building,
    this.area_locality,
    this.city
  ].filter(Boolean);
  return parts.join(', ');
});

export const Address = mongoose.model<IAddress>('Address', addressSchema);
