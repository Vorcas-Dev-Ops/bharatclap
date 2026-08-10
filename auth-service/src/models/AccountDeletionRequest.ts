import mongoose, { Document, Schema, Types } from 'mongoose';

export type AccountDeletionStatus =
  | 'REQUESTED'
  | 'VERIFIED'
  | 'BLOCKED_PENDING_OBLIGATION'
  | 'PROCESSING'
  | 'FAILED_NEEDS_REVIEW'
  | 'DELETED'
  | 'PARTIALLY_RETAINED'
  | 'REJECTED';

export type RazorpayDeletionStatus =
  | 'NOT_APPLICABLE'
  | 'REQUESTED'
  | 'COMPLETED'
  | 'RETAINED_BY_PROCESSOR';

export interface IAccountDeletionRequest extends Document {
  request_id: string;
  user_id: Types.ObjectId;
  account_type: 'CUSTOMER' | 'PROVIDER';
  status: AccountDeletionStatus;
  requested_at: Date;
  verified_at?: Date;
  completed_at?: Date;
  reason?: string;
  blocking_obligations: string[];
  retention_status: 'NONE' | 'PARTIAL' | 'FULL';
  retained_data_summary: string[];
  razorpay_request_status: RazorpayDeletionStatus;
  audit_reference: string;
  audit_trail: Array<{
    status: string;
    timestamp: Date;
    note?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const accountDeletionRequestSchema = new Schema<IAccountDeletionRequest>(
  {
    request_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    account_type: {
      type: String,
      enum: ['CUSTOMER', 'PROVIDER'],
      required: true,
    },
    status: {
      type: String,
      enum: [
        'REQUESTED',
        'VERIFIED',
        'BLOCKED_PENDING_OBLIGATION',
        'PROCESSING',
        'FAILED_NEEDS_REVIEW',
        'DELETED',
        'PARTIALLY_RETAINED',
        'REJECTED',
      ],
      default: 'REQUESTED',
      required: true,
      index: true,
    },
    requested_at: {
      type: Date,
      default: Date.now,
      required: true,
    },
    verified_at: {
      type: Date,
    },
    completed_at: {
      type: Date,
    },
    reason: {
      type: String,
      trim: true,
    },
    blocking_obligations: [
      {
        type: String,
      },
    ],
    retention_status: {
      type: String,
      enum: ['NONE', 'PARTIAL', 'FULL'],
      default: 'NONE',
    },
    retained_data_summary: [
      {
        type: String,
      },
    ],
    razorpay_request_status: {
      type: String,
      enum: ['NOT_APPLICABLE', 'REQUESTED', 'COMPLETED', 'RETAINED_BY_PROCESSOR'],
      default: 'NOT_APPLICABLE',
    },
    audit_reference: {
      type: String,
      required: true,
      trim: true,
    },
    audit_trail: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
  },
  { timestamps: true }
);

// DB Partial Unique Index: Only 1 Active Deletion Workflow per user
accountDeletionRequestSchema.index(
  { user_id: 1, status: 1 },
  {
    partialFilterExpression: {
      status: { $in: ['REQUESTED', 'VERIFIED', 'BLOCKED_PENDING_OBLIGATION', 'PROCESSING'] },
    },
    unique: true,
  }
);

export const AccountDeletionRequest = mongoose.model<IAccountDeletionRequest>(
  'AccountDeletionRequest',
  accountDeletionRequestSchema
);
