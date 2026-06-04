import mongoose, { Document, Schema, Types } from 'mongoose';

export interface INotification extends Document {
  recipient_id: Types.ObjectId; // User or Provider ID
  recipient_type: 'User' | 'Provider';
  title: string;
  message: string;
  type: 'booking_alert' | 'payment_alert' | 'system_alert' | 'status_update';
  metadata?: any; // To store booking_id, etc.
  is_read: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient_id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    recipient_type: {
      type: String,
      enum: ['User', 'Provider'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['booking_alert', 'payment_alert', 'system_alert', 'status_update'],
      default: 'system_alert',
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    is_read: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipient_id: 1, is_read: 1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
