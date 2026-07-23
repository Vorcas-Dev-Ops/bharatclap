import mongoose, { Document, Schema } from 'mongoose';

export interface IWebhookLog extends Document {
  event_id?: string;
  event_type: string;
  signature_valid: boolean;
  received_at: Date;
  processed_at?: Date;
  result: 'success' | 'failed' | 'ignored';
  error_message?: string;
  payload: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const webhookLogSchema = new Schema<IWebhookLog>(
  {
    event_id: { type: String, index: true },
    event_type: { type: String, required: true },
    signature_valid: { type: Boolean, required: true, default: false },
    received_at: { type: Date, default: Date.now },
    processed_at: { type: Date },
    result: { type: String, enum: ['success', 'failed', 'ignored'], required: true },
    error_message: { type: String },
    payload: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

webhookLogSchema.index({ createdAt: -1 });

export const WebhookLog = mongoose.model<IWebhookLog>('WebhookLog', webhookLogSchema);
