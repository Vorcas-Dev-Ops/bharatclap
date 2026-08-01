import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILocationChangeRequest extends Document {
  provider_id: Types.ObjectId;
  user_id: Types.ObjectId;
  current_location_id?: Types.ObjectId | null;
  current_location_name?: string;
  requested_location_id: Types.ObjectId;
  requested_location_name?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  admin_comment?: string;
  reviewed_at?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const locationChangeRequestSchema = new Schema<ILocationChangeRequest>(
  {
    provider_id: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
      index: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    current_location_id: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    current_location_name: {
      type: String,
      trim: true,
    },
    requested_location_id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    requested_location_name: {
      type: String,
      trim: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    reviewed_by: {
      type: String,
      trim: true,
    },
    admin_comment: {
      type: String,
      trim: true,
    },
    reviewed_at: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

locationChangeRequestSchema.index({ provider_id: 1, status: 1 });
locationChangeRequestSchema.index({ createdAt: -1 });

export const LocationChangeRequest = mongoose.model<ILocationChangeRequest>(
  'LocationChangeRequest',
  locationChangeRequestSchema
);
