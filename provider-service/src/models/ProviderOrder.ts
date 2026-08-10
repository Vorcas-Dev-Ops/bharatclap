import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProviderOrder extends Document {
  provider_id: Types.ObjectId;
  kit: {
    kit_id: Types.ObjectId;
    kit_name: string;
    price: number;
    gst: number;
    delivery: number;
    convenience: number;
    size?: string;
  };
  accessories: Array<{
    accessory_id: Types.ObjectId;
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  subtotal: number;
  gst_amount: number;
  grand_total: number;
  payment_status: 'pending' | 'paid' | 'failed' | 'skipped';
  payment_id?: string;
  razorpay_order_id?: string;
  paidAt?: Date;
  fulfillmentStatus?: 'awaiting_approval' | 'ready_for_pickup' | 'collected' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

const providerOrderSchema = new Schema<IProviderOrder>(
  {
    provider_id: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
      unique: true, // one order per provider onboarding
    },
    kit: {
      kit_id: { type: Schema.Types.ObjectId, required: true },
      kit_name: { type: String, required: true },
      price: { type: Number, required: true },
      gst: { type: Number, default: 18 },
      delivery: { type: Number, default: 0 },
      convenience: { type: Number, default: 0 },
      size: { type: String },
    },
    accessories: [
      {
        accessory_id: { type: Schema.Types.ObjectId, required: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        unit_price: { type: Number, required: true },
        total_price: { type: Number, required: true },
      },
    ],
    subtotal: { type: Number, required: true, default: 0 },
    gst_amount: { type: Number, required: true, default: 0 },
    grand_total: { type: Number, required: true, default: 0 },
    payment_status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'skipped'],
      default: 'pending',
    },
    payment_id: { type: String },
    razorpay_order_id: { type: String },
    paidAt: { type: Date },
    fulfillmentStatus: {
      type: String,
      enum: ['awaiting_approval', 'ready_for_pickup', 'collected', 'completed'],
      default: 'awaiting_approval',
    },
  },
  { timestamps: true }
);

providerOrderSchema.index({ payment_status: 1 });

export const ProviderOrder = mongoose.model<IProviderOrder>('ProviderOrder', providerOrderSchema);
