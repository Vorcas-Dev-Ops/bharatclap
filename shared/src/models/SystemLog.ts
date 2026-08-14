import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemLog extends Document {
  level: 'info' | 'warn' | 'error';
  category: 'system' | 'provider' | 'user';
  service: string;
  message: string;
  error_code?: string;
  stack?: string;
  path?: string;
  method?: string;
  correlation_id?: string;
  meta?: Record<string, any>;
  created_at: Date;
}

const systemLogSchema = new Schema<ISystemLog>(
  {
    level: { type: String, enum: ['info', 'warn', 'error'], required: true, index: true },
    category: { type: String, enum: ['system', 'provider', 'user'], required: true, index: true },
    service: { type: String, required: true, index: true },
    message: { type: String, required: true },
    error_code: { type: String },
    stack: { type: String },
    path: { type: String },
    method: { type: String },
    correlation_id: { type: String },
    meta: { type: Schema.Types.Mixed },
    created_at: { type: Date, default: Date.now, index: { expires: 2592000 } }, // ponytail: 30-day TTL, bump if retention needs grow
  },
  { timestamps: false }
);

// Compound index for the admin query pattern: filter by category, sort by time
systemLogSchema.index({ category: 1, created_at: -1 });

export const SystemLog = mongoose.model<ISystemLog>('SystemLog', systemLogSchema);
