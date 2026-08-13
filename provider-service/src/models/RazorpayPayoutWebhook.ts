import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRazorpayPayoutWebhook extends Document {
  event_id: string;
  event_type: string;
  payout_id: string;
  settlement_id?: Types.ObjectId;
  payload: Record<string, any>;
  processed_at: Date;
  createdAt: Date;
  updatedAt: Date;
}

const razorpayPayoutWebhookSchema = new Schema<IRazorpayPayoutWebhook>(
  {
    event_id: { type: String, required: true, unique: true }, // X-Razorpay-Event-Id header or event.id
    event_type: { type: String, required: true },
    payout_id: { type: String, required: true, index: true },
    settlement_id: { type: Schema.Types.ObjectId, ref: 'ProviderSettlement' },
    payload: { type: Schema.Types.Mixed, required: true },
    processed_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const RazorpayPayoutWebhook = mongoose.model<IRazorpayPayoutWebhook>(
  'RazorpayPayoutWebhook',
  razorpayPayoutWebhookSchema
);
