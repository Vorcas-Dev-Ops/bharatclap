import mongoose, { Document, Schema, Types } from 'mongoose';

export type OutboxStatus = 'PENDING' | 'COMPLETED_WITH_BLOCK' | 'COMPLETED' | 'FAILED_NEEDS_REVIEW';

export interface IAccountDeletionOutbox extends Document {
  request_id: Types.ObjectId;
  user_id: Types.ObjectId;
  account_type: 'CUSTOMER' | 'PROVIDER';
  event_type: string;
  status: OutboxStatus;
  attempts: number;
  next_retry_at: Date;
  processed_at?: Date;
  last_error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const accountDeletionOutboxSchema = new Schema<IAccountDeletionOutbox>(
  {
    request_id: {
      type: Schema.Types.ObjectId,
      ref: 'AccountDeletionRequest',
      required: true,
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
    event_type: {
      type: String,
      default: 'PROCESS_ACCOUNT_DELETION',
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED_WITH_BLOCK', 'COMPLETED', 'FAILED_NEEDS_REVIEW'],
      default: 'PENDING',
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
      required: true,
    },
    next_retry_at: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    processed_at: {
      type: Date,
    },
    last_error: {
      type: String,
    },
  },
  { timestamps: true }
);

export const AccountDeletionOutbox = mongoose.model<IAccountDeletionOutbox>(
  'AccountDeletionOutbox',
  accountDeletionOutboxSchema
);
