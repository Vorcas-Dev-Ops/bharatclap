import mongoose, { Document, Schema } from 'mongoose';

export type PricingType = 'FIXED_SURCHARGE' | 'PERCENTAGE_SURCHARGE' | 'FIXED_DISCOUNT' | 'PERCENTAGE_DISCOUNT';
export type RuleStatus = 'draft' | 'scheduled' | 'active' | 'expired' | 'disabled' | 'archived';

export interface ITimeSlotRule extends Document {
  categoryId?: string;
  categoryName?: string;
  subserviceId?: string;
  ruleName: string;
  pricingType: PricingType;
  startTime: string;
  endTime: string;
  extraCharge: number; // Amount or percentage value
  priority: number;
  isStackable: boolean;
  isExclusive: boolean;
  city?: string;
  zone?: string;
  membershipRequired?: string;
  daysOfWeek?: number[]; // [0..6] (Sun..Sat)
  validFrom?: Date;
  validUntil?: Date;
  maxExtraCharge?: number;
  status: RuleStatus;
  version: number;
  isActive: boolean;
}

const TimeSlotRuleSchema: Schema = new Schema({
  categoryId: { type: String },
  categoryName: { type: String },
  subserviceId: { type: String },
  ruleName: { type: String, required: true },
  pricingType: {
    type: String,
    enum: ['FIXED_SURCHARGE', 'PERCENTAGE_SURCHARGE', 'FIXED_DISCOUNT', 'PERCENTAGE_DISCOUNT'],
    default: 'FIXED_SURCHARGE'
  },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  extraCharge: { type: Number, required: true, default: 0 },
  priority: { type: Number, default: 10 },
  isStackable: { type: Boolean, default: true },
  isExclusive: { type: Boolean, default: false },
  city: { type: String },
  zone: { type: String },
  membershipRequired: { type: String },
  daysOfWeek: { type: [Number], default: [] },
  validFrom: { type: Date },
  validUntil: { type: Date },
  maxExtraCharge: { type: Number },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'active', 'expired', 'disabled', 'archived'],
    default: 'active'
  },
  version: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const TimeSlotRule = mongoose.model<ITimeSlotRule>('TimeSlotRule', TimeSlotRuleSchema);

