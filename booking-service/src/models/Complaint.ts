import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IComplaint extends Document {
  user_id: Types.ObjectId;
  service_id?: Types.ObjectId;
  booking_id?: Types.ObjectId;
  complaint: string;
  status: 'pending' | 'resolved' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

const complaintSchema = new Schema<IComplaint>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    service_id: {
      type: Schema.Types.ObjectId,
    },
    booking_id: {
      type: Schema.Types.ObjectId,
    },
    complaint: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'resolved', 'closed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

complaintSchema.index({ user_id: 1 });
complaintSchema.index({ service_id: 1 });
complaintSchema.index({ booking_id: 1 });
complaintSchema.index({ status: 1 });
complaintSchema.index({ user_id: 1, status: 1 });

export const Complaint = mongoose.model<IComplaint>('Complaint', complaintSchema);
