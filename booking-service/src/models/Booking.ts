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

  status: 'pending' | 'provider_searching' | 'unassigned_timeout' | 'HIGH_DEMAND_TIMEOUT' | 'assigned' | 'accepted' | 'rejected' | 'on_the_way' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'cancellation_requested' | 'refund_processing' | 'waiting_start_otp' | 'waiting_end_otp' | 'service_completed' | 'payment_pending';
  dispatch_status?: 'Waiting' | 'Searching' | 'Offered' | 'Accepted' | 'Rejected' | 'Timeout' | 'Reassigning' | 'Provider Assigned' | string;
  payment_status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded' | 'paid';
  settlement_status?: 'Not Created' | 'Queued' | 'Created' | 'On Hold' | 'Ready' | 'In Batch' | 'Processing' | 'Transferred' | 'Paid' | 'Failed' | string;
  paid_via?: 'Online' | 'Cash on Delivery' | 'Wallet' | 'Wallet + Online' | 'Wallet + COD' | string;

  scheduled_at: Date;
  booking_time: string;

  invoice_id?: Types.ObjectId | string;
  service_price: number;
  discount_amount: number;
  slot_charge?: number;
  payable_amount: number;
  quote_id?: string;
  slotPricingSnapshot?: any;
  pricingExplainabilityTrace?: any[];

  financial_snapshots?: Array<{
    version: number;
    created_at: Date;
    base_price: number;
    slot_charge?: number;
    surge?: number;
    coupon_code?: string;
    discount_amount: number;
    platform_fee: number;
    commission_amount: number;
    gst_amount: number;
    provider_share: number;
    customer_payable: number;
    reason?: string;
  }>;

  payment_method?: 'cod' | 'online' | 'wallet' | string;
  payment_id?: Types.ObjectId | string;
  payment_link_status?: 'linked' | 'pending' | 'failed';
  idempotency_key?: string;
  correlation_id?: string;

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

  assigned_at?: Date;
  accepted_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  cancelled_at?: Date;
  cancelled_by?: 'customer' | 'provider' | 'admin';

  estimatedDistance?: number;
  estimatedTravelMinutes?: number;
  estimatedArrivalTime?: Date;
  navigationUrl?: string;

  start_otp?: string;
  completion_otp?: string;
  startOtp?: string;
  startOtpVerified?: boolean;
  startOtpVerifiedAt?: Date;
  startOtpGeneratedAt?: Date;
  startOtpExpiresAt?: Date;
  startOtpAttempts?: number;
  serviceStartedAt?: Date;
  endOtp?: string;
  endOtpVerified?: boolean;
  endOtpVerifiedAt?: Date;
  endOtpGeneratedAt?: Date;
  endOtpExpiresAt?: Date;
  endOtpAttempts?: number;
  serviceEndedAt?: Date;
  provider_response_time?: number;
  provider_arrival_time?: Date;

  invoice_url?: string;

  beforePhotos?: string[];
  afterPhotos?: string[];

  redispatch_count?: number;
  max_redispatch_attempts?: number;
  last_redispatch_at?: Date;
  refund_reference_id?: string;
  previous_providers?: {
    provider_id?: Types.ObjectId;
    accepted_at?: Date;
    unassigned_at?: Date;
    reason?: string;
  }[];

  admin_notes?: {
    note: string;
    addedBy: string;
    createdAt: Date;
  }[];

  estimatedDuration?: number;
  actualDuration?: number;
  plannedEndTime?: Date;
  actualEndTime?: Date;
  reservedTravelStart?: Date;
  reservedTravelEnd?: Date;

  payment_collection?: {
    status: 'none' | 'pending' | 'cash_collected' | 'upi_pending' | 'upi_completed' | 'verified' | 'disputed' | 'partial' | 'expired' | 'admin_exception';
    method?: 'cash' | 'upi' | 'prepaid';
    final_amount: number;
    collected_amount: number;
    remaining_amount: number;
    confirmed_by?: 'provider' | 'customer' | 'system' | 'admin';
    confirmed_at?: Date;
    transaction_id?: string;
    payment_link_id?: string;
    payment_link_url?: string;
    expires_at?: Date;
    customer_confirmed?: boolean;
    customer_confirmed_at?: Date;
    attempts: number;
    payment_links?: {
      link_id: string;
      url: string;
      amount: number;
      status: 'active' | 'paid' | 'expired' | 'cancelled';
      created_at: Date;
    }[];
    provider_confirmation?: {
      gps_coordinates?: [number, number];
      timestamp: Date;
      device_id?: string;
      ip_address?: string;
    };
    financial_snapshot?: {
      subtotal: number;
      extra_charges: number;
      taxes: number;
      discount: number;
      final_amount: number;
      platform_commission: number;
      provider_earning: number;
      applied_rates?: {
        commission_pct: number;
        gst_pct: number;
        tds_pct: number;
        tcs_pct: number;
        hold_days: number;
      };
    };
    payout?: {
      status: 'pending' | 'processing' | 'paid' | 'failed';
      payout_id?: string;
      paid_at?: Date;
    };
  };

  finance_status: 'pending' | 'collecting' | 'payment_verified' | 'settlement_created' |
    'settlement_hold' | 'ready_for_payout' | 'paid' | 'disputed' | 'expired';

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
      enum: ['pending', 'scheduled', 'provider_searching', 'unassigned_timeout', 'HIGH_DEMAND_TIMEOUT', 'assigned', 'provider_accepted', 'accepted', 'confirmed', 'ready_confirmed', 'cancellation_requested', 'delayed', 'expired', 'rejected', 'on_the_way', 'arrived', 'reached', 'otp_verified', 'in_progress', 'completed', 'cancelled', 'refund_processing', 'waiting_start_otp', 'waiting_end_otp', 'reassigned', 'service_completed', 'payment_pending'],
      default: 'pending',
      index: true,
    },
    dispatch_status: {
      type: String,
      default: 'Waiting',
    },
    payment_status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded', 'paid'],
      default: 'pending',
    },
    settlement_status: {
      type: String,
      default: 'Not Created',
    },
    paid_via: {
      type: String,
    },
    scheduled_at: {
      type: Date,
      required: true,
    },
    booking_time: {
      type: String,
      required: true,
    },
    invoice_id: {
      type: Schema.Types.Mixed,
      index: true,
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
    slot_charge: {
      type: Number,
      default: 0,
    },
    payable_amount: {
      type: Number,
      required: true,
      default: 0,
    },
    quote_id: {
      type: String,
    },
    slotPricingSnapshot: {
      type: Schema.Types.Mixed,
    },
    pricingExplainabilityTrace: {
      type: Schema.Types.Mixed,
    },
    financial_snapshots: [
      {
        version: { type: Number, required: true },
        created_at: { type: Date, default: Date.now },
        base_price: { type: Number, required: true },
        slot_charge: { type: Number, default: 0 },
        surge: { type: Number, default: 0 },
        coupon_code: { type: String },
        discount_amount: { type: Number, default: 0 },
        platform_fee: { type: Number, default: 0 },
        commission_amount: { type: Number, default: 0 },
        gst_amount: { type: Number, default: 0 },
        provider_share: { type: Number, default: 0 },
        customer_payable: { type: Number, required: true },
        reason: { type: String },
      },
    ],
    payment_method: {
      type: String,
    },
    payment_id: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
    },
    payment_link_status: {
      type: String,
      enum: ['linked', 'pending', 'failed'],
      default: 'pending',
    },
    idempotency_key: {
      type: String,
      trim: true,
    },
    correlation_id: {
      type: String,
      trim: true,
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
    assigned_at: {
      type: Date,
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
    startOtpVerifiedAt: {
      type: Date,
    },
    startOtpGeneratedAt: {
      type: Date,
    },
    startOtpExpiresAt: {
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
    endOtpVerifiedAt: {
      type: Date,
    },
    endOtpGeneratedAt: {
      type: Date,
    },
    endOtpExpiresAt: {
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
    estimatedDistance: {
      type: Number,
    },
    estimatedTravelMinutes: {
      type: Number,
    },
    estimatedArrivalTime: {
      type: Date,
    },
    navigationUrl: {
      type: String,
    },
    invoice_url: {
      type: String,
    },
    afterPhotos: {
      type: [String],
      default: [],
    },
    redispatch_count: {
      type: Number,
      default: 0,
    },
    max_redispatch_attempts: {
      type: Number,
      default: 3,
    },
    last_redispatch_at: {
      type: Date,
    },
    refund_reference_id: {
      type: String,
    },
    previous_providers: [{
      provider_id: { type: Schema.Types.ObjectId, ref: 'Provider' },
      accepted_at: { type: Date },
      unassigned_at: { type: Date },
      reason: { type: String }
    }],
    admin_notes: [{
      note: { type: String, required: true },
      addedBy: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    }],
    payment_collection: {
      status: { type: String, enum: ['none', 'pending', 'cash_collected', 'upi_pending', 'upi_completed', 'verified', 'disputed', 'partial', 'expired', 'admin_exception'], default: 'none' },
      method: { type: String, enum: ['cash', 'upi', 'prepaid'] },
      final_amount: { type: Number, default: 0 },
      collected_amount: { type: Number, default: 0 },
      remaining_amount: { type: Number, default: 0 },
      confirmed_by: { type: String, enum: ['provider', 'customer', 'system', 'admin'] },
      confirmed_at: { type: Date },
      transaction_id: { type: String },
      payment_link_id: { type: String },
      payment_link_url: { type: String },
      expires_at: { type: Date },
      customer_confirmed: { type: Boolean },
      customer_confirmed_at: { type: Date },
      attempts: { type: Number, default: 0 },
      payment_links: [{
        link_id: { type: String, required: true },
        url: { type: String, required: true },
        amount: { type: Number, required: true },
        status: { type: String, enum: ['active', 'paid', 'expired', 'cancelled'], default: 'active' },
        created_at: { type: Date, default: Date.now },
      }],
      provider_confirmation: {
        gps_coordinates: { type: [Number] },
        timestamp: { type: Date },
        device_id: { type: String },
        ip_address: { type: String },
      },
      financial_snapshot: {
        subtotal: { type: Number },
        extra_charges: { type: Number },
        taxes: { type: Number },
        discount: { type: Number },
        final_amount: { type: Number },
        platform_commission: { type: Number },
        provider_earning: { type: Number },
        applied_rates: {
          commission_pct: { type: Number },
          gst_pct: { type: Number },
          tds_pct: { type: Number },
          tcs_pct: { type: Number },
          hold_days: { type: Number },
        },
      },
      payout: {
        status: { type: String, enum: ['pending', 'processing', 'paid', 'failed'] },
        payout_id: { type: String },
        paid_at: { type: Date },
      },
    },
    finance_status: {
      type: String,
      enum: ['pending', 'collecting', 'payment_verified', 'settlement_created',
             'settlement_hold', 'ready_for_payout', 'paid', 'disputed', 'expired'],
      default: 'pending',
      index: true,
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

bookingSchema.index({ scheduled_at: 1 });
bookingSchema.index({ order_id: 1 });
bookingSchema.index({ status: 1, scheduled_at: 1 });
bookingSchema.index({ provider_id: 1, scheduled_at: 1, status: 1 });
bookingSchema.index({ user_id: 1, status: 1 });
bookingSchema.index({ provider_id: 1, status: 1 });
bookingSchema.index({ isDeleted: 1, status: 1, createdAt: -1 });
bookingSchema.index({ isDeleted: 1, createdAt: -1 });
bookingSchema.index({ status: 1, createdAt: -1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ subservice_id: 1 });

bookingSchema.post('init', function(doc: any) {
  (doc as any)._originalStatus = doc.status;
  (doc as any)._originalPaymentStatus = doc.payment_status;
});

bookingSchema.post('save', async function(doc: any) {
  try {
    const BookingActivity = mongoose.model('BookingActivity');
    
    if ((doc as any)._originalStatus !== doc.status) {
      const oldStatus = (doc as any)._originalStatus;
      const newStatus = doc.status;
      
      let actor: 'customer' | 'provider' | 'admin' | 'system' = 'system';
      if (newStatus === 'waiting_start_otp' || newStatus === 'waiting_end_otp' || newStatus === 'in_progress' || newStatus === 'completed' || newStatus === 'service_completed') {
        actor = 'provider';
      } else if (newStatus === 'cancelled') {
        actor = doc.cancelled_by === 'admin' ? 'admin' : (doc.cancelled_by === 'provider' ? 'provider' : 'customer');
      }
      
      await BookingActivity.create({
        booking_id: doc._id,
        action: newStatus,
        actor,
        details: { oldStatus, newStatus }
      });
      (doc as any)._originalStatus = doc.status;
    }

    if ((doc as any)._originalPaymentStatus !== doc.payment_status) {
      const oldVal = (doc as any)._originalPaymentStatus;
      const newVal = doc.payment_status;
      
      if (newVal === 'paid') {
        await BookingActivity.create({
          booking_id: doc._id,
          action: 'payment_verified',
          actor: 'system',
          details: { oldPaymentStatus: oldVal, newPaymentStatus: newVal }
        });
      }
      (doc as any)._originalPaymentStatus = doc.payment_status;
    }
  } catch (err: any) {
    console.error('[BOOKING ACTIVITY HOOK ERROR]', err.message);
  }
});

bookingSchema.index({ status: 1, payment_status: 1, scheduled_at: -1, createdAt: -1 });
bookingSchema.index({ user_id: 1, createdAt: -1 });
bookingSchema.index({ provider_id: 1, createdAt: -1 });

export const Booking = mongoose.model<IBooking>('Booking', bookingSchema);
