import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRefreshToken extends Document {
  user_id: Types.ObjectId;
  token_hash: string;
  device_info: string;
  ip_address: string;
  revoked: boolean;
  expires_at: Date;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token_hash: {
      type: String,
      required: true,
      unique: true,
    },
    device_info: {
      type: String,
      default: 'Unknown Device',
    },
    ip_address: {
      type: String,
      default: 'Unknown IP',
    },
    revoked: {
      type: Boolean,
      default: false,
    },
    expires_at: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Automatically delete document when it reaches expires_at
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for finding valid tokens quickly
refreshTokenSchema.index({ user_id: 1, revoked: 1 });

export const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', refreshTokenSchema);
