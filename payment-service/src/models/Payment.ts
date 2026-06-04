import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPayment extends Document {
  booking_id: Types.ObjectId;
  amount: number;
  payment_method: 'UPI' | 'Card' | 'COD';
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  transaction_id?: string;
  payment_date?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    booking_id: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    payment_method: {
      type: String,
      enum: ['UPI', 'Card', 'COD'],
      required: true,
    },
    payment_status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
      required: true,
    },
    transaction_id: {
      type: String,
      trim: true,
    },
    payment_date: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
