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

export type FinancialClearanceStatus =
  | 'NOT_REQUIRED'
  | 'REVIEW_REQUIRED'
  | 'SETTLEMENT_PENDING'
  | 'PROCESSING_SETTLEMENT_PENDING'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'PROMOTIONAL_CREDIT_FORFEITED'
  | 'LIABILITY_PENDING'
  | 'FINANCIALLY_CLEARED'
  | 'FAILED_NEEDS_REVIEW';

export interface IAccountDeletionRequest extends Document {
  request_id: string;
  user_id: Types.ObjectId;
  account_type: 'CUSTOMER' | 'PROVIDER';
  status: AccountDeletionStatus;
  financial_clearance_status?: FinancialClearanceStatus;
  financial_snapshot?: {
    earnings_owed_paise: number;
    pending_settlement_paise: number;
    purchased_wallet_paise: number;
    promotional_credit_paise: number;
    active_subscription_paise: number;
    lead_package_paise: number;
    outstanding_liability_paise: number;
    has_open_dispute: boolean;
  };
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
    admin_user_id?: string;
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
    financial_clearance_status: {
      type: String,
      enum: [
        'NOT_REQUIRED',
        'REVIEW_REQUIRED',
        'SETTLEMENT_PENDING',
        'PROCESSING_SETTLEMENT_PENDING',
        'REFUND_PENDING',
        'REFUNDED',
        'PROMOTIONAL_CREDIT_FORFEITED',
        'LIABILITY_PENDING',
        'FINANCIALLY_CLEARED',
        'FAILED_NEEDS_REVIEW',
      ],
      default: 'NOT_REQUIRED',
      index: true,
    },
    financial_snapshot: {
      earnings_owed_paise: { type: Number, default: 0 },
      pending_settlement_paise: { type: Number, default: 0 },
      purchased_wallet_paise: { type: Number, default: 0 },
      promotional_credit_paise: { type: Number, default: 0 },
      active_subscription_paise: { type: Number, default: 0 },
      lead_package_paise: { type: Number, default: 0 },
      outstanding_liability_paise: { type: Number, default: 0 },
      has_open_dispute: { type: Boolean, default: false },
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
