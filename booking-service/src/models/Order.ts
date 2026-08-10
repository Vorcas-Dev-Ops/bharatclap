import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IOrder extends Document {
  order_id: string;
  user_id: Types.ObjectId;
  booking_ids: Types.ObjectId[];
  total_amount: number;
  total_discount: number;
  final_amount: number;
  coupon_code?: string;
  payment_status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded' | 'paid';
  payment_method?: 'cod' | 'online' | 'wallet' | string;
  payment_id?: Types.ObjectId | string;
  payment_link_status?: 'linked' | 'pending' | 'failed';
  idempotency_key?: string;
  correlation_id?: string;
  refund_amount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    order_id: {
      type: String,
      required: true,
      unique: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    booking_ids: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Booking',
      },
    ],
    total_amount: {
      type: Number,
      required: true,
      default: 0,
    },
    total_discount: {
      type: Number,
      default: 0,
    },
    final_amount: {
      type: Number,
      required: true,
      default: 0,
    },
    coupon_code: {
      type: String,
    },
    payment_status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded', 'paid'],
      default: 'pending',
    },
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
      index: true,
      sparse: true,
    },
    correlation_id: {
      type: String,
      trim: true,
    },
    refund_amount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const Order = mongoose.model<IOrder>('Order', orderSchema);

