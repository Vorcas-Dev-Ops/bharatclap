import mongoose, { Document, Schema } from 'mongoose';

export interface IPricingQuoteItem {
  subservice_id: string;
  quantity: number;
  base_price: number;
  subtotal: number;
}

export interface IPricingQuoteStep {
  step: string;
  description: string;
  before: number;
  change: number;
  after: number;
  ruleId?: string;
  ruleName?: string;
  timestamp: Date;
}

export interface IPricingQuote extends Document {
  quote_id: string;
  user_id: mongoose.Types.ObjectId;
  items: IPricingQuoteItem[];
  subtotal: number;
  slot_charge: number;
  membership_discount: number;
  coupon_discount: number;
  tax_amount: number;
  final_total: number;
  pricingSnapshot: {
    appliedRules: any[];
    explainabilityTrace: IPricingQuoteStep[];
    rulesVersion: number;
    quoteCreatedAt: Date;
  };
  hmacSignature: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';
  expires_at: Date;
  created_at: Date;
}

const PricingQuoteSchema: Schema = new Schema({
  quote_id: { type: String, required: true, unique: true, index: true },
  user_id: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  items: [{
    subservice_id: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    base_price: { type: Number, required: true },
    subtotal: { type: Number, required: true }
  }],
  subtotal: { type: Number, required: true },
  slot_charge: { type: Number, default: 0 },
  membership_discount: { type: Number, default: 0 },
  coupon_discount: { type: Number, default: 0 },
  tax_amount: { type: Number, default: 0 },
  final_total: { type: Number, required: true },
  pricingSnapshot: {
    appliedRules: { type: Schema.Types.Mixed, default: [] },
    explainabilityTrace: { type: Schema.Types.Mixed, default: [] },
    rulesVersion: { type: Number, default: 1 },
    quoteCreatedAt: { type: Date, default: Date.now }
  },
  hmacSignature: { type: String, required: true },
  status: {
    type: String,
    enum: ['ACTIVE', 'USED', 'EXPIRED', 'CANCELLED'],
    default: 'ACTIVE'
  },
  expires_at: { type: Date, required: true, index: true }
}, { timestamps: true });

export const PricingQuote = mongoose.model<IPricingQuote>('PricingQuote', PricingQuoteSchema);
