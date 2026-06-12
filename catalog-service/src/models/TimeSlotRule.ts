import mongoose, { Document, Schema } from 'mongoose';

export interface ITimeSlotRule extends Document {
  categoryId: string;
  categoryName: string;
  ruleName: string;
  startTime: string;
  endTime: string;
  extraCharge: number;
  isActive: boolean;
}

const TimeSlotRuleSchema: Schema = new Schema({
  categoryId: { type: String, required: true },
  categoryName: { type: String, required: true },
  ruleName: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  extraCharge: { type: Number, required: true, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const TimeSlotRule = mongoose.model<ITimeSlotRule>('TimeSlotRule', TimeSlotRuleSchema);
