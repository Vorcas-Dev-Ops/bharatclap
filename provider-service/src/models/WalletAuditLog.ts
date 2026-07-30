import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IWalletAuditLog extends Document {
  transactionRefId: string;
  date: Date;
  source?: 'System' | 'Admin' | 'Razorpay' | 'Booking' | 'Refund' | 'Subscription' | 'Referral';
  adminId?: Types.ObjectId;
  adminName: string;
  adminRole: string;
  providerId: Types.ObjectId;
  providerName: string;
  action: string;
  amount: number;
  previousBalance: number;
  newBalance: number;
  reason: string;
  remarks: string;
  bookingId?: string;
  paymentId?: string;
  ipAddress: string;
  status: 'Active' | 'Manual Freeze' | 'Automatic Freeze' | 'Pending Approval';
  approvalStatus: 'approved' | 'pending_approval' | 'rejected';
  approvedBy?: Types.ObjectId;
  approvedByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const walletAuditLogSchema = new Schema<IWalletAuditLog>(
  {
    transactionRefId: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now, required: true },
    source: {
      type: String,
      enum: ['System', 'Admin', 'Razorpay', 'Booking', 'Refund', 'Subscription', 'Referral'],
      default: 'Admin',
    },
    adminId: { type: Schema.Types.ObjectId, ref: 'User' },
    adminName: { type: String, required: true },
    adminRole: { type: String, default: 'super_admin' },
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', required: true },
    providerName: { type: String, required: true },
    action: {
      type: String,
      required: true,
    },
    amount: { type: Number, default: 0 },
    previousBalance: { type: Number, default: 0 },
    newBalance: { type: Number, default: 0 },
    reason: { type: String, required: true },
    remarks: { type: String, required: true },
    bookingId: { type: String },
    paymentId: { type: String },
    ipAddress: { type: String, default: '127.0.0.1' },
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
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedByName: { type: String },
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
