import mongoose, { Document, Schema, Types } from 'mongoose';

export enum WalletSource {
  ANDROID_APP = 'ANDROID_APP',
  IOS_APP = 'IOS_APP',
  WEB_PROVIDER = 'WEB_PROVIDER',
  WEB_CUSTOMER = 'WEB_CUSTOMER',
  ADMIN_PANEL = 'ADMIN_PANEL',
  API_GATEWAY = 'API_GATEWAY',
  INTERNAL_SERVICE = 'INTERNAL_SERVICE',
  PAYMENT_WEBHOOK = 'PAYMENT_WEBHOOK',
  REFUND_ENGINE = 'REFUND_ENGINE',
  SETTLEMENT_ENGINE = 'SETTLEMENT_ENGINE',
  SYSTEM_JOB = 'SYSTEM_JOB',
  MIGRATION = 'MIGRATION',
  // Backward compatibility legacy aliases
  System = 'SYSTEM_JOB',
  Admin = 'ADMIN_PANEL',
  Razorpay = 'PAYMENT_WEBHOOK',
  Booking = 'INTERNAL_SERVICE',
  Refund = 'REFUND_ENGINE',
  Subscription = 'INTERNAL_SERVICE',
  Referral = 'INTERNAL_SERVICE'
}

export type ActorType = 'provider' | 'admin' | 'customer' | 'system';

export interface IWalletAuditLog extends Document {
  provider_id: Types.ObjectId;
  providerId?: Types.ObjectId;
  transaction_id?: Types.ObjectId;
  action: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  previousBalance?: number;
  newBalance?: number;
  source: WalletSource | string;
  actor_type: ActorType;
  actor_id?: string;
  adminId?: Types.ObjectId;
  adminName?: string;
  adminRole?: string;
  providerName?: string;
  reason: string;
  remarks?: string;
  device_type?: string;
  app_version?: string;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
  correlation_id?: string;
  reference_id: string;
  transactionRefId?: string;
  bookingId?: string;
  paymentId?: string;
  status: 'Active' | 'Manual Freeze' | 'Automatic Freeze' | 'Pending Approval';
  approvalStatus: 'approved' | 'pending_approval' | 'rejected';
  approvedBy?: Types.ObjectId;
  approvedByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const walletAuditLogSchema = new Schema<IWalletAuditLog>(
  {
    provider_id: { type: Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider' },
    transaction_id: { type: Schema.Types.ObjectId, ref: 'WalletTransaction' },
    action: { type: String, required: true, index: true },
    transaction_type: { type: String, required: true },
    amount: { type: Number, required: true, default: 0 },
    balance_before: { type: Number, required: true, default: 0 },
    balance_after: { type: Number, required: true, default: 0 },
    previousBalance: { type: Number, default: 0 },
    newBalance: { type: Number, default: 0 },
    source: {
      type: String,
      required: true,
      default: WalletSource.SYSTEM_JOB,
      index: true
    },
    actor_type: {
      type: String,
      enum: ['provider', 'admin', 'customer', 'system'],
      default: 'system',
      required: true
    },
    actor_id: { type: String },
    adminId: { type: Schema.Types.ObjectId, ref: 'User' },
    adminName: { type: String, default: 'System' },
    adminRole: { type: String, default: 'system' },
    providerName: { type: String, default: 'Service Expert' },
    reason: { type: String, required: true },
    remarks: { type: String },
    device_type: { type: String, default: 'web' },
    app_version: { type: String, default: '1.0.0' },
    ip_address: { type: String, default: '127.0.0.1' },
    user_agent: { type: String },
    request_id: { type: String },
    correlation_id: { type: String, index: true },
    reference_id: { type: String, required: true, unique: true, index: true },
    transactionRefId: { type: String },
    bookingId: { type: String },
    paymentId: { type: String },
    status: {
      type: String,
      enum: ['Active', 'Manual Freeze', 'Automatic Freeze', 'Pending Approval'],
      default: 'Active',
    },
    approvalStatus: {
      type: String,
      enum: ['approved', 'pending_approval', 'rejected'],
      default: 'approved',
    },
  },
  { timestamps: true }
);

// IMMUTABILITY RULE: Prevent updates or deletions on audit log records
walletAuditLogSchema.pre('updateOne', function () {
  throw new Error('IMMUTABLE AUDIT LOG: Wallet audit logs cannot be updated or modified.');
});
walletAuditLogSchema.pre('findOneAndUpdate', function () {
  throw new Error('IMMUTABLE AUDIT LOG: Wallet audit logs cannot be updated or modified.');
});
walletAuditLogSchema.pre('deleteOne', function () {
  throw new Error('IMMUTABLE AUDIT LOG: Wallet audit logs cannot be deleted.');
});
walletAuditLogSchema.pre('findOneAndDelete', function () {
  throw new Error('IMMUTABLE AUDIT LOG: Wallet audit logs cannot be deleted.');
});

export const WalletAuditLog = mongoose.model<IWalletAuditLog>('WalletAuditLog', walletAuditLogSchema);
