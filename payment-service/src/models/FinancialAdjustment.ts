import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IFinancialAdjustment extends Document {
  adjustment_number: string;
  provider_id: Types.ObjectId | string;
  adjustment_type: 'bonus' | 'penalty' | 'recovery' | 'incentive' | 'correction';
  amount: number;
  reason: string;
  created_by: string;
  status: 'pending' | 'applied' | 'cancelled';
  applied_settlement_id?: Types.ObjectId | string;
  correlation_id?: string;
  createdAt: Date;
}

const financialAdjustmentSchema = new Schema<IFinancialAdjustment>(
  {
    adjustment_number: { type: String, required: true, unique: true, index: true },
    provider_id: { type: Schema.Types.Mixed, required: true, index: true },
    adjustment_type: {
      type: String,
      enum: ['bonus', 'penalty', 'recovery', 'incentive', 'correction'],
      required: true,
    },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    created_by: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'applied', 'cancelled'],
      default: 'pending',
    },
    applied_settlement_id: { type: Schema.Types.Mixed },
    correlation_id: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable adjustments!
  }
);

financialAdjustmentSchema.index({ provider_id: 1, status: 1 });

export const FinancialAdjustment = mongoose.model<IFinancialAdjustment>('FinancialAdjustment', financialAdjustmentSchema);
