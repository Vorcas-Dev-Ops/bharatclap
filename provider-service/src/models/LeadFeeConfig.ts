import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILeadFeeConfig extends Document {
  subservice_id: Types.ObjectId;
  category_name: string;
  lead_fee: number;
}

const leadFeeConfigSchema = new Schema<ILeadFeeConfig>({
  subservice_id: { type: Schema.Types.ObjectId, required: true, unique: true },
  category_name: { type: String, required: true },
  lead_fee: { type: Number, required: true, default: 100 }
});

export const LeadFeeConfig = mongoose.model<ILeadFeeConfig>('LeadFeeConfig', leadFeeConfigSchema);
