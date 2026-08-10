import mongoose, { Document, Schema, Types } from 'mongoose';

export type RazorpayQrStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'MISMATCH' | 'FAILED';

export interface IRazorpayPaymentQr extends Document {
  booking_id: Types.ObjectId;
  customer_id: Types.ObjectId;
  amount_paise: number; // Integer representation in paise (e.g. ₹1,104.15 -> 110415)
  currency: string;
  
  razorpay_qr_id: string;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  
  status: RazorpayQrStatus;
  qr_payload: string;
  idempotency_key: string;
  expires_at: Date;
  paid_at?: Date;
  webhook_event_id?: string;
  
  audit_trail: Array<{
    status: string;
    timestamp: Date;
    note?: string;
  }>;
  
  createdAt: Date;
  updatedAt: Date;
}

const razorpayPaymentQrSchema = new Schema<IRazorpayPaymentQr>(
  {
    booking_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    customer_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    amount_paise: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      default: 'INR',
      required: true,
    },
    razorpay_qr_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    razorpay_payment_id: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    razorpay_order_id: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'EXPIRED', 'MISMATCH', 'FAILED'],
      default: 'PENDING',
      required: true,
      index: true,
    },
    qr_payload: {
      type: String,
      required: true,
    },
    idempotency_key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    expires_at: {
      type: Date,
      required: true,
    },
    paid_at: {
      type: Date,
    },
    webhook_event_id: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
      unique: true,
    },
    audit_trail: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
  },
  { timestamps: true }
);

// DB Partial Unique Index: Only 1 PENDING Razorpay QR allowed per booking
razorpayPaymentQrSchema.index(
  { booking_id: 1, status: 1 },
  {
    partialFilterExpression: { status: 'PENDING' },
    unique: true,
  }
);

export const RazorpayPaymentQr = mongoose.model<IRazorpayPaymentQr>(
  'RazorpayPaymentQr',
  razorpayPaymentQrSchema
);
