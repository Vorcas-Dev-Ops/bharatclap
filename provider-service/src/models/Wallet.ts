import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IWallet extends Document {
  provider_id: Types.ObjectId;
  balance: number;
  currency: string;
  transactions: {
    amount: number;
    type: 'credit' | 'debit';
    transaction_type: 'job_payout' | 'withdrawal' | 'penalty' | 'bonus' | 'refund';
    description: string;
    booking_id?: Types.ObjectId;
    reference_id?: string;
    status: 'pending' | 'completed' | 'failed';
    createdAt: Date;
  }[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const walletSchema = new Schema<IWallet>(
  {
    provider_id: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
      unique: true,
    },
    balance: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    transactions: [
      {
        amount: { type: Number, required: true },
        type: { type: String, enum: ['credit', 'debit'], required: true },
        transaction_type: { 
          type: String, 
          enum: ['job_payout', 'withdrawal', 'penalty', 'bonus', 'refund'],
          required: true 
        },
        description: { type: String, required: true },
        booking_id: { type: Schema.Types.ObjectId },
        reference_id: { type: String },
        status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);
