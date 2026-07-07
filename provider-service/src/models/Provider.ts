import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProvider extends Document {
  user_id: Types.ObjectId;
  availability_status: 'available' | 'busy' | 'offline';
  isOnline: boolean;
  isBusy: boolean;
  kyc_status: 'pending' | 'verified' | 'rejected';
  is_verified: boolean;
  
  // Service Areas
  service_locations: Types.ObjectId[]; // IDs from Locations collection

  // Live Tracking
  live_location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  serviceRadius: number; // in meters (default 10000)
  socketId?: string;
  lastActiveAt?: Date;

  // Legacy/Other
  aadhar_last4?: string;
  aadhar_hash?: string;
  bank_details?: {
    account_holder_name: string;
    account_number_last4: string;
    account_number_hash: string;
    ifsc_code: string;
    bank_name: string;
    branch: string;
  };
  verification_docs?: {
    id_proof_url: string;
    public_id?: string;
    resource_type?: string;
  };
  kyc_rejection_reason?: string;
  verified_at?: Date;
  verification_docs_expiry?: Date;
  
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const providerSchema = new Schema<IProvider>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
    },
    availability_status: {
      type: String,
      enum: ['available', 'busy', 'offline'],
      default: 'offline',
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    isBusy: {
      type: Boolean,
      default: false,
    },
    service_locations: [{
      type: Schema.Types.ObjectId,
    }],
    kyc_status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    is_verified: {
      type: Boolean,
      default: false,
    },
    live_location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
    serviceRadius: {
      type: Number,
      default: 10000, // 10km in meters
    },
    socketId: {
      type: String,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    aadhar_last4: { type: String, trim: true },
    aadhar_hash: { type: String },
    bank_details: {
      account_holder_name: { type: String, trim: true },
      account_number_last4: { type: String, trim: true },
      account_number_hash: { type: String },
      ifsc_code: { type: String, trim: true },
      bank_name: { type: String, trim: true },
      branch: { type: String, trim: true },
    },
    verification_docs: {
      id_proof_url: { type: String, trim: true },
      public_id: { type: String, trim: true },
      resource_type: { type: String, trim: true },
    },
    kyc_rejection_reason: { type: String },
    verified_at: { type: Date },
    verification_docs_expiry: { type: Date },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

providerSchema.index({ live_location: '2dsphere' });
providerSchema.index({ service_locations: 1 });

// Added compound indexes for dispatch and admin query optimization
providerSchema.index({ kyc_status: 1, isDeleted: 1, isOnline: 1 });
providerSchema.index({ service_locations: 1, kyc_status: 1, isDeleted: 1 });
providerSchema.index({ isDeleted: 1, createdAt: -1 });

export const Provider = mongoose.model<IProvider>('Provider', providerSchema);
