import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICompensationOutbox extends Document {
  bookingId: string;
  providerId: string;
  action: 'UNASSIGN_COMPENSATION';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  failureReason?: string; // 'PROVIDER_VALIDATION' | 'WALLET_FAILURE' | 'CALENDAR_FAILURE' | 'DATABASE_FAILURE' | 'NETWORK_FAILURE' | 'INFRASTRUCTURE_FAILURE' | 'UNKNOWN'
  failureSource?: string; // 'provider' | 'infrastructure'
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const compensationOutboxSchema = new Schema<ICompensationOutbox>(
  {
    bookingId: {
      type: String,
      required: true,
      index: true,
    },
    providerId: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      enum: ['UNASSIGN_COMPENSATION'],
      default: 'UNASSIGN_COMPENSATION',
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    failureReason: {
      type: String,
      default: 'UNKNOWN',
    },
    failureSource: {
      type: String,
      enum: ['provider', 'infrastructure'],
      default: 'infrastructure',
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    lastError: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

compensationOutboxSchema.index({ status: 1, attempts: 1, createdAt: 1 });

export const CompensationOutbox = mongoose.model<ICompensationOutbox>('CompensationOutbox', compensationOutboxSchema);
