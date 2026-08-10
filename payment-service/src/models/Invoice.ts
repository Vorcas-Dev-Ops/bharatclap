import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IInvoice extends Document {
  invoice_number: string;
  booking_id: Types.ObjectId | string;
  user_id: Types.ObjectId | string;
  version: number; // 1 for initial, 2 for additional charges revision
  base_price: number;
  surge: number;
  coupons_discount: number;
  materials_charge: number;
  extra_services_charge: number;
  platform_commission: number;
  gst_on_commission: number;
  final_total: number;
  status: 'issued' | 'paid' | 'superseded' | 'cancelled';
  previous_invoice_id?: Types.ObjectId | string;
  issued_at: Date;
  paid_at?: Date;
  createdAt: Date;
}

const invoiceSchema = new Schema<IInvoice>(
  {
    invoice_number: { type: String, required: true, unique: true, index: true },
    booking_id: { type: Schema.Types.Mixed, required: true, index: true },
    user_id: { type: Schema.Types.Mixed, required: true, index: true },
    version: { type: Number, default: 1, required: true },
    base_price: { type: Number, required: true, default: 0 },
    surge: { type: Number, default: 0 },
    coupons_discount: { type: Number, default: 0 },
    materials_charge: { type: Number, default: 0 },
    extra_services_charge: { type: Number, default: 0 },
    platform_commission: { type: Number, default: 0 },
    gst_on_commission: { type: Number, default: 0 },
    final_total: { type: Number, required: true },
    status: {
      type: String,
      enum: ['issued', 'paid', 'superseded', 'cancelled'],
      default: 'issued',
    },
    previous_invoice_id: { type: Schema.Types.Mixed },
    issued_at: { type: Date, default: Date.now },
    paid_at: { type: Date },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable invoice records!
  }
);

invoiceSchema.index({ booking_id: 1, version: 1 });

export const Invoice = mongoose.model<IInvoice>('Invoice', invoiceSchema);
