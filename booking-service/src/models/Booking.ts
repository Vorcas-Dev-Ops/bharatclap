import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IBooking extends Document {
  booking_id: string;
  order_id?: Types.ObjectId;
  user_id: Types.ObjectId;
  provider_id?: Types.ObjectId;
  subservice_id: Types.ObjectId;
  provider_service_id?: Types.ObjectId;
  address_id: Types.ObjectId;
  variant_name?: string;

  status: 'pending' | 'provider_searching' | 'accepted' | 'rejected' | 'on_the_way' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'refund_processing' | 'waiting_start_otp' | 'waiting_end_otp';

  scheduled_at: Date;
  booking_time: string;

  service_price: number;
  discount_amount: number;
  payable_amount: number;

  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_method?: 'cod' | 'online' | 'wallet';

  refund_status?: 'none' | 'initiated' | 'processing' | 'completed' | 'failed';
  refund_amount?: number;
  refund_id?: string;
  refund_processed_at?: Date;

  commission_percentage?: number;
  commission_amount?: number;
  provider_payout?: number;

  cancellation_fee?: number;
  cancel_reason_category?: 'changed_mind' | 'booked_by_mistake' | 'provider_issue' | 'price_issue' | 'other';
  cancellation_reason?: string;

  accepted_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  cancelled_at?: Date;
  cancelled_by?: 'customer' | 'provider' | 'admin';

  start_otp?: string;
  completion_otp?: string;
  startOtp?: string;
  startOtpVerified?: boolean;
  startOtpGeneratedAt?: Date;
  startOtpAttempts?: number;
  serviceStartedAt?: Date;
  endOtp?: string;
  endOtpVerified?: boolean;
  endOtpGeneratedAt?: Date;
  endOtpAttempts?: number;
  serviceEndedAt?: Date;
  provider_response_time?: number; // In minutes
  provider_arrival_time?: Date;

  invoice_url?: string;

  is_reviewed: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<IBooking>(
  {
    booking_id: {
      type: String,
      unique: true,
      required: true,
    },
    order_id: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
    user_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    provider_id: {
      type: Schema.Types.ObjectId,
      required: false,
      index: true,
    },
    subservice_id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    provider_service_id: {
      type: Schema.Types.ObjectId,
      required: false,
    },
    address_id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    variant_name: {
      type: String,
    },
    status: {
      type: String,
      enum: ['pending', 'provider_searching', 'accepted', 'rejected', 'on_the_way', 'arrived', 'in_progress', 'completed', 'cancelled', 'refund_processing', 'waiting_start_otp', 'waiting_end_otp'],
      default: 'pending',
      index: true,
    },
    scheduled_at: {
      type: Date,
      required: true,
    },
    booking_time: {
      type: String,
      required: true,
    },
    service_price: {
      type: Number,
      required: true,
      default: 0,
    },
    discount_amount: {
      type: Number,
      default: 0,
    },
    payable_amount: {
      type: Number,
      required: true,
      default: 0,
    },
    payment_status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    payment_method: {
      type: String,
      enum: ['cod', 'online', 'wallet'],
    },
    refund_status: {
      type: String,
      enum: ['none', 'initiated', 'processing', 'completed', 'failed'],
      default: 'none',
    },
    refund_amount: {
      type: Number,
    },
    refund_id: {
      type: String,
    },
    refund_processed_at: {
      type: Date,
    },
    commission_percentage: {
      type: Number,
    },
    commission_amount: {
      type: Number,
    },
    provider_payout: {
      type: Number,
    },
    cancellation_fee: {
      type: Number,
      default: 0,
    },
    cancel_reason_category: {
      type: String,
      enum: ['changed_mind', 'booked_by_mistake', 'provider_issue', 'price_issue', 'other'],
    },
    cancellation_reason: {
      type: String,
    },
    accepted_at: {
      type: Date,
    },
    started_at: {
      type: Date,
    },
    completed_at: {
      type: Date,
    },
    cancelled_at: {
      type: Date,
    },
    cancelled_by: {
      type: String,
      enum: ['customer', 'provider', 'admin'],
    },
    start_otp: {
      type: String,
    },
    completion_otp: {
      type: String,
    },
    startOtp: {
      type: String,
    },
    startOtpVerified: {
      type: Boolean,
      default: false,
    },
    startOtpGeneratedAt: {
      type: Date,
    },
    startOtpAttempts: {
      type: Number,
      default: 0,
    },
    serviceStartedAt: {
      type: Date,
    },
    endOtp: {
      type: String,
    },
    endOtpVerified: {
      type: Boolean,
      default: false,
    },
    endOtpGeneratedAt: {
      type: Date,
    },
    endOtpAttempts: {
      type: Number,
      default: 0,
    },
    serviceEndedAt: {
      type: Date,
    },
    provider_response_time: {
      type: Number,
    },
    provider_arrival_time: {
      type: Date,
    },
    invoice_url: {
      type: String,
    },
    is_reviewed: {
      type: Boolean,
      default: false,
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

// bookingSchema.index({ user_id: 1 }); // Covered by compound index
// bookingSchema.index({ provider_id: 1 }); // Covered by compound index
// bookingSchema.index({ status: 1 }); // Covered by compound index
bookingSchema.index({ scheduled_at: 1 });
bookingSchema.index({ order_id: 1 });

// Added compound indexes for optimized query performance
bookingSchema.index({ user_id: 1, status: 1 });
bookingSchema.index({ provider_id: 1, status: 1 });
bookingSchema.index({ isDeleted: 1, status: 1, createdAt: -1 });
bookingSchema.index({ isDeleted: 1, createdAt: -1 }); // Added for P-3 (booking chart)
bookingSchema.index({ status: 1, createdAt: -1 }); // Added for P-3 (revenue chart)
bookingSchema.index({ createdAt: -1 }); // Added for P-3 (default chart queries)
bookingSchema.index({ applied_coupon: 1 });
bookingSchema.index({ subservice_id: 1 });

export const Booking = mongoose.model<IBooking>('Booking', bookingSchema);
