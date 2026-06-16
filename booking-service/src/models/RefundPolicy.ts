import mongoose, { Document, Schema } from 'mongoose';

export interface IRefundPolicy extends Document {
  cancelWithinBookingHours: number;
  bookingCancellationFee: number;
  lastMinuteHours: number;
  lastMinuteCancellationFee: number;
  allowCancellationAfterProviderAssigned: boolean;
  allowCancellationAfterServiceStarted: boolean;
  updatedBy?: string;
  updatedAt?: Date;
}

const RefundPolicySchema: Schema = new Schema({
  cancelWithinBookingHours: { type: Number, default: 12 },
  bookingCancellationFee: { type: Number, default: 150 },
  lastMinuteHours: { type: Number, default: 3 },
  lastMinuteCancellationFee: { type: Number, default: 300 },
  allowCancellationAfterProviderAssigned: { type: Boolean, default: true },
  allowCancellationAfterServiceStarted: { type: Boolean, default: false },
  updatedBy: { type: String }
}, { timestamps: true });

export const RefundPolicy = mongoose.model<IRefundPolicy>('RefundPolicy', RefundPolicySchema);
