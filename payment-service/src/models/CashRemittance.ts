import mongoose, { Document, Schema, Types } from 'mongoose';

export type RemittanceStatus = 'PENDING_REMITTANCE' | 'REMITTED' | 'RECONCILED' | 'DISPUTED';

export interface ICashRemittance extends Document {
  collection_id: Types.ObjectId;
  booking_id: Types.ObjectId;
  provider_id: Types.ObjectId;
  amount: number;
  status: RemittanceStatus;
  
  collected_at: Date;
  remitted_at?: Date;
  reconciled_at?: Date;
  
  remittance_reference?: string;
  proof_reference?: string;
  reconciled_by?: Types.ObjectId;
  
  createdAt: Date;
  updatedAt: Date;
}

const cashRemittanceSchema = new Schema<ICashRemittance>(
  {
    collection_id: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },
    booking_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    provider_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['PENDING_REMITTANCE', 'REMITTED', 'RECONCILED', 'DISPUTED'],
      default: 'PENDING_REMITTANCE',
      required: true,
      index: true,
    },
    collected_at: {
      type: Date,
      default: Date.now,
      required: true,
    },
    remitted_at: {
      type: Date,
    },
    reconciled_at: {
      type: Date,
    },
    remittance_reference: {
      type: String,
      trim: true,
    },
    proof_reference: {
      type: String,
      trim: true,
    },
    reconciled_by: {
      type: Schema.Types.ObjectId,
    },
  },
  { timestamps: true }
);

export const CashRemittance = mongoose.model<ICashRemittance>(
  'CashRemittance',
  cashRemittanceSchema
);
