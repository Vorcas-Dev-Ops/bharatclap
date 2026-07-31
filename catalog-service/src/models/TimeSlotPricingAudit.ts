import mongoose, { Document, Schema } from 'mongoose';

export interface ITimeSlotPricingAudit extends Document {
  ruleId: mongoose.Types.ObjectId;
  version: number;
  action: 'create' | 'update' | 'toggle' | 'delete' | 'archived';
  beforeState?: any;
  afterState?: any;
  adminId?: string;
  adminName?: string;
  reason?: string;
  ipAddress?: string;
  correlationId?: string;
  createdAt: Date;
}

const TimeSlotPricingAuditSchema: Schema = new Schema({
  ruleId: { type: Schema.Types.ObjectId, required: true, ref: 'TimeSlotRule' },
  version: { type: Number, required: true },
  action: { type: String, required: true, enum: ['create', 'update', 'toggle', 'delete', 'archived'] },
  beforeState: { type: Schema.Types.Mixed },
  afterState: { type: Schema.Types.Mixed },
  adminId: { type: String },
  adminName: { type: String },
  reason: { type: String },
  ipAddress: { type: String },
  correlationId: { type: String },
}, { timestamps: true });

export const TimeSlotPricingAudit = mongoose.model<ITimeSlotPricingAudit>('TimeSlotPricingAudit', TimeSlotPricingAuditSchema);
