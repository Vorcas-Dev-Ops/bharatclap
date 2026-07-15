import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminActivityLog extends Document {
  admin_id: mongoose.Types.ObjectId;
  admin_name: string;
  action: string;
  target_id: string;
  details: any;
  ip_address?: string;
  user_agent?: string;
  timestamp: Date;
}

const adminActivityLogSchema = new Schema<IAdminActivityLog>(
  {
    admin_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    admin_name: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    target_id: {
      type: String,
      required: false,
    },
    details: {
      type: Schema.Types.Mixed,
      required: false,
    },
    ip_address: {
      type: String,
      required: false,
    },
    user_agent: {
      type: String,
      required: false,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const AdminActivityLog = mongoose.model<IAdminActivityLog>('AdminActivityLog', adminActivityLogSchema);
