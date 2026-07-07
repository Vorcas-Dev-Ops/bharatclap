import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IKitOrder extends Document {
  orderId: string;
  providerId?: Types.ObjectId; // Optional if not linked yet
  providerName: string;
  phone: string;
  address: string;
  service: string;
  size: string;
  amount: number;
  payment: 'Pending' | 'Paid' | 'Waived' | 'Failed';
  status: 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
  trackingId?: string;
  courier?: string;
  date: Date;
}

const kitOrderSchema = new Schema<IKitOrder>({
  orderId: { type: String, required: true, unique: true },
  providerId: { type: Schema.Types.ObjectId, ref: 'Provider' },
  providerName: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  service: { type: String, required: true },
  size: { type: String, required: true },
  amount: { type: Number, required: true, default: 0 },
  payment: { type: String, enum: ['Pending', 'Paid', 'Waived', 'Failed'], default: 'Pending' },
  status: { type: String, enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'], default: 'Pending' },
  trackingId: { type: String },
  courier: { type: String },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

export const KitOrder = mongoose.model<IKitOrder>('KitOrder', kitOrderSchema);
