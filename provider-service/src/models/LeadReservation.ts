import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILeadReservation extends Document {
  reservation_id: string;
  provider_id: Types.ObjectId;
  package_order_id: Types.ObjectId;
  booking_id: string;
  status: 'RESERVED' | 'COMMITTED' | 'RELEASED';
  expires_at: Date;
  createdAt: Date;
  updatedAt: Date;
}

const leadReservationSchema = new Schema<ILeadReservation>(
  {
    reservation_id: { type: String, required: true, unique: true, index: true },
    provider_id: { type: Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    package_order_id: { type: Schema.Types.ObjectId, ref: 'LeadPackageOrder', required: true },
    booking_id: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['RESERVED', 'COMMITTED', 'RELEASED'],
      default: 'RESERVED',
      index: true,
    },
    expires_at: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

leadReservationSchema.index({ status: 1, expires_at: 1 });

export const LeadReservation = mongoose.model<ILeadReservation>('LeadReservation', leadReservationSchema);
