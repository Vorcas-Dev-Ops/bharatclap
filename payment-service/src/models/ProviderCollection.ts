import mongoose, { Document, Schema, Types } from 'mongoose';

export type CollectionMethod = 'PROVIDER_UPI' | 'PROVIDER_CASH';

export type CollectionStatus =
  | 'INITIATED'
  | 'AWAITING_CUSTOMER'
  | 'CUSTOMER_CONFIRMED'
  | 'PROVIDER_CONFIRMED'
  | 'CONFIRMED_BY_BOTH'
  | 'CASH_CONFIRMED'
  | 'VERIFIED'
  | 'DISPUTED'
  | 'UNDER_REVIEW'
  | 'RESOLVED_CUSTOMER'
  | 'RESOLVED_PROVIDER'
  | 'CANCELLED'
  | 'EXPIRED';

export interface IProviderCollection extends Document {
  booking_id: Types.ObjectId;
  provider_id: Types.ObjectId;
  customer_id: Types.ObjectId;
  method: CollectionMethod;
  status: CollectionStatus;
  
  qr_reference: string;
  qr_payload: string;
  qr_generated_at: Date;
  qr_expires_at: Date;
  
  amount_snapshot: {
    amount: number;
    service_amount: number;
    additional_charges: number;
    tax: number;
    discount: number;
  };
  
  provider_upi_id: string;
  customer_transaction_reference?: string; // Untrusted UTR entered by customer
  verified_transaction_reference?: string; // Trusted reference set on payment verification
  
  cash_reason?: 'CUSTOMER_UPI_UNAVAILABLE' | 'NETWORK_ISSUE' | 'PROVIDER_QR_UNAVAILABLE' | 'OTHER';
  cash_reason_details?: string;
  
  customer_confirmed_at?: Date;
  provider_confirmed_at?: Date;
  verified_at?: Date;
  
  idempotency_key: string;
  createdAt: Date;
  updatedAt: Date;
}

const providerCollectionSchema = new Schema<IProviderCollection>(
  {
    booking_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    provider_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    customer_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    method: {
      type: String,
      enum: ['PROVIDER_UPI', 'PROVIDER_CASH'],
      required: true,
    },
    status: {
      type: String,
      enum: [
        'INITIATED',
        'AWAITING_CUSTOMER',
        'CUSTOMER_CONFIRMED',
        'PROVIDER_CONFIRMED',
        'CONFIRMED_BY_BOTH',
        'CASH_CONFIRMED',
        'VERIFIED',
        'DISPUTED',
        'UNDER_REVIEW',
        'RESOLVED_CUSTOMER',
        'RESOLVED_PROVIDER',
        'CANCELLED',
        'EXPIRED',
      ],
      default: 'INITIATED',
      required: true,
      index: true,
    },
    qr_reference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    qr_payload: {
      type: String,
      required: true,
    },
    qr_generated_at: {
      type: Date,
      default: Date.now,
    },
    qr_expires_at: {
      type: Date,
      required: true,
    },
    amount_snapshot: {
      amount: { type: Number, required: true },
      service_amount: { type: Number, required: true },
      additional_charges: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
    },
    provider_upi_id: {
      type: String,
      trim: true,
    },
    customer_transaction_reference: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    verified_transaction_reference: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    cash_reason: {
      type: String,
      enum: ['CUSTOMER_UPI_UNAVAILABLE', 'NETWORK_ISSUE', 'PROVIDER_QR_UNAVAILABLE', 'OTHER'],
    },
    cash_reason_details: {
      type: String,
      trim: true,
    },
    customer_confirmed_at: {
      type: Date,
    },
    provider_confirmed_at: {
      type: Date,
    },
    verified_at: {
      type: Date,
    },
    idempotency_key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// Single active collection index constraint per booking
providerCollectionSchema.index(
  { booking_id: 1, status: 1 },
  {
    partialFilterExpression: {
      status: {
        $in: ['INITIATED', 'AWAITING_CUSTOMER', 'CUSTOMER_CONFIRMED', 'PROVIDER_CONFIRMED'],
      },
    },
  }
);

export const ProviderCollection = mongoose.model<IProviderCollection>(
  'ProviderCollection',
  providerCollectionSchema
);
