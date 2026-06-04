import mongoose, { Document, Schema } from 'mongoose';

export interface IAdminReport extends Document {
  type: string;         // e.g. 'revenue', 'bookings', 'users'
  data_json: Record<string, any>;
  generated_at: Date;
  createdAt: Date;
  updatedAt: Date;
}

const adminReportSchema = new Schema<IAdminReport>(
  {
    type: {
      type: String,
      required: true,
      trim: true,
    },
    data_json: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    generated_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const AdminReport = mongoose.model<IAdminReport>('AdminReport', adminReportSchema);
