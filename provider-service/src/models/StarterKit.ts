import mongoose, { Document, Schema } from 'mongoose';

export interface IStarterKit extends Document {
  name: string;
  description: string;
  status: 'active' | 'inactive';
  items: Array<{ name: string; description: string; stock: number }>;
  sizes: Array<{ size: string; active: boolean; stock: number }>;
  price: number;
  gst: number;
  delivery: number;
  convenience: number;
  estimatedDays: number;
  shippingPartner: string;
  enableLiveTracking: boolean;
  paymentMandatory: boolean;
  allowRegistrationWithoutPayment: boolean;
  autoActivateAfterPayment: boolean;
  requireAdminApproval: boolean;
  images?: {
    banner?: string;
    tshirt?: string;
    bag?: string;
    idcard?: string;
    kit?: string;
  };
  isDeleted: boolean;
}

const starterKitSchema = new Schema<IStarterKit>({
  name: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  items: [{
    name: { type: String },
    description: { type: String },
    stock: { type: Number, default: 0 }
  }],
  sizes: [{
    size: { type: String },
    active: { type: Boolean, default: true },
    stock: { type: Number, default: 0 }
  }],
  price: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  delivery: { type: Number, default: 0 },
  convenience: { type: Number, default: 0 },
  estimatedDays: { type: Number, default: 5 },
  shippingPartner: { type: String },
  enableLiveTracking: { type: Boolean, default: true },
  paymentMandatory: { type: Boolean, default: true },
  allowRegistrationWithoutPayment: { type: Boolean, default: false },
  autoActivateAfterPayment: { type: Boolean, default: false },
  requireAdminApproval: { type: Boolean, default: true },
  images: {
    banner: { type: String },
    tshirt: { type: String },
    bag: { type: String },
    idcard: { type: String },
    kit: { type: String }
  },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

export const StarterKit = mongoose.model<IStarterKit>('StarterKit', starterKitSchema);
