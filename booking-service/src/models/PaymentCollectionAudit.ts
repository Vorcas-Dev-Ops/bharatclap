import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPaymentCollectionAudit extends Document {
  booking_id: Types.ObjectId;
  action: string;
  actor: 'provider' | 'customer' | 'system' | 'admin';
  actor_id?: Types.ObjectId;
  amount?: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

const paymentCollectionAuditSchema = new Schema<IPaymentCollectionAudit>(
  {
    booking_id: { type: Schema.Types.ObjectId, required: true, index: true },
    action: {
      type: String,
      required: true,
      enum: [
        'otp_verified', 'payment_link_created', 'payment_link_expired', 'payment_link_regenerated',
        'cash_selected', 'cash_confirmed', 'customer_confirmed', 'upi_selected',
        'upi_success', 'upi_failed', 'expired', 'disputed', 'admin_override',
        'admin_resend_link', 'admin_cancel_link', 'admin_mark_offline',
        'admin_force_settlement', 'admin_retry_settlement', 'admin_retry_payout',
        'settlement_created', 'provider_released',
      ],
    },
    actor: { type: String, required: true, enum: ['provider', 'customer', 'system', 'admin'] },
    actor_id: { type: Schema.Types.ObjectId },
    amount: { type: Number },
    metadata: { type: Schema.Types.Mixed },
    timestamp: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false }
);

// Append-only: compound index for efficient chronological queries
paymentCollectionAuditSchema.index({ booking_id: 1, timestamp: 1 });

export const PaymentCollectionAudit = mongoose.model<IPaymentCollectionAudit>(
  'PaymentCollectionAudit',
  paymentCollectionAuditSchema
);
