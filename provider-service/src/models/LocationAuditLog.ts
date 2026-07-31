import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILocationAuditLog extends Document {
  correlation_id: string;
  dispatch_id?: string;
  booking_id?: string;
  request_id?: string;
  provider_id: Types.ObjectId;
  location_id: Types.ObjectId;
  action: 'LOCATION_ENABLED' | 'LOCATION_PAUSED' | 'LOCATION_SUSPENDED' | 'LOCATION_UPDATED';
  changed_by: 'provider' | 'admin' | 'system';
  reason?: string;
  before: Record<string, any>;
  after: Record<string, any>;
  timestamp: Date;
}

const locationAuditLogSchema = new Schema<ILocationAuditLog>(
  {
    correlation_id: { type: String, required: true },
    dispatch_id: { type: String },
    booking_id: { type: String },
    request_id: { type: String },
    provider_id: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    location_id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    action: {
      type: String,
      enum: ['LOCATION_ENABLED', 'LOCATION_PAUSED', 'LOCATION_SUSPENDED', 'LOCATION_UPDATED'],
      required: true,
    },
    changed_by: {
      type: String,
      enum: ['provider', 'admin', 'system'],
      default: 'provider',
    },
    reason: { type: String },
    before: { type: Schema.Types.Mixed, default: {} },
    after: { type: Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

locationAuditLogSchema.index({ provider_id: 1, timestamp: -1 });
locationAuditLogSchema.index({ location_id: 1, timestamp: -1 });
locationAuditLogSchema.index({ correlation_id: 1 });

export const LocationAuditLog = mongoose.model<ILocationAuditLog>(
  'LocationAuditLog',
  locationAuditLogSchema
);
