import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAccessoryOrder extends Document {
  provider_id: Types.ObjectId;
  items: Array<{
    accessory_id: Types.ObjectId;
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  subtotal: number;
  gst_amount: number;
  delivery_charge: number;
  grand_total: number;
  payment_status: 'pending' | 'paid' | 'failed';
  payment_id?: string;
  razorpay_order_id?: string;
  order_status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const accessoryOrderSchema = new Schema<IAccessoryOrder>(
  {
    provider_id: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    items: [
      {
        accessory_id: {
          type: Schema.Types.ObjectId,
          required: true,
        },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        unit_price: { type: Number, required: true },
        total_price: { type: Number, required: true },
      },
    ],
    subtotal: { type: Number, required: true, default: 0 },
    gst_amount: { type: Number, required: true, default: 0 },
    delivery_charge: { type: Number, required: true, default: 0 },
    grand_total: { type: Number, required: true, default: 0 },
    payment_status: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    payment_id: { type: String },
    razorpay_order_id: { type: String },
    order_status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

accessoryOrderSchema.index({ provider_id: 1, createdAt: -1 });
accessoryOrderSchema.index({ payment_status: 1 });

export const AccessoryOrder = mongoose.model<IAccessoryOrder>('AccessoryOrder', accessoryOrderSchema);
