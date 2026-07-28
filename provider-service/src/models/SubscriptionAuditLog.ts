import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISubscriptionAuditLog extends Document {
  providerId: Types.ObjectId;
  action: 'grant_free_access' | 'extend_duration' | 'change_policy' | 'auto_expire' | 'enter_grace_period' | 'suspend' | 'resume';
  performedBy: 'Admin' | 'System';
  adminUserId?: Types.ObjectId;
  adminName?: string;
  reason?: string;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
  createdAt: Date;
}

const subscriptionAuditLogSchema = new Schema<ISubscriptionAuditLog>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    action: {
      type: String,
      enum: ['grant_free_access', 'extend_duration', 'change_policy', 'auto_expire', 'enter_grace_period', 'suspend', 'resume'],
      required: true,
    },
    performedBy: { type: String, enum: ['Admin', 'System'], required: true },
    adminUserId: { type: Schema.Types.ObjectId },
    adminName: { type: String },
    reason: { type: String },
    previousState: { type: Schema.Types.Mixed },
    newState: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const SubscriptionAuditLog = mongoose.model<ISubscriptionAuditLog>('SubscriptionAuditLog', subscriptionAuditLogSchema);
