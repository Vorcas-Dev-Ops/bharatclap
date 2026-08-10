import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IFinancialAuditLog extends Document {
  user_id?: Types.ObjectId | string;
  admin_id?: Types.ObjectId | string;
  action: string;
  before_value?: Record<string, any>;
  after_value?: Record<string, any>;
  ip_address?: string;
  device_info?: string;
  correlation_id?: string;
  reason?: string;
  createdAt: Date;
}

const financialAuditLogSchema = new Schema<IFinancialAuditLog>(
  {
    user_id: { type: Schema.Types.Mixed, index: true },
    admin_id: { type: Schema.Types.Mixed, index: true },
    action: { type: String, required: true, index: true },
    before_value: { type: Schema.Types.Mixed },
    after_value: { type: Schema.Types.Mixed },
    ip_address: { type: String },
    device_info: { type: String },
    correlation_id: { type: String, index: true },
    reason: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable audit log!
  }
);

financialAuditLogSchema.index({ correlation_id: 1 });
financialAuditLogSchema.index({ createdAt: -1 });

export const FinancialAuditLog = mongoose.model<IFinancialAuditLog>('FinancialAuditLog', financialAuditLogSchema);
