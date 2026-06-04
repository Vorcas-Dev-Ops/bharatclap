import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IOrder extends Document {
  order_id: string;
  user_id: Types.ObjectId;
  booking_ids: Types.ObjectId[];
  total_amount: number;
  total_discount: number;
  final_amount: number;
  coupon_code?: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'partially_refunded' | 'refunded';
  payment_method?: 'cod' | 'online' | 'wallet';
  payment_id?: string;
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
      enum: ['pending', 'paid', 'failed', 'partially_refunded', 'refunded'],
      default: 'pending',
    },
    payment_method: {
      type: String,
      enum: ['cod', 'online', 'wallet'],
    },
    payment_id: {
      type: String,
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

orderSchema.index({ order_id: 1 });
orderSchema.index({ user_id: 1 });

export const Order = mongoose.model<IOrder>('Order', orderSchema);
