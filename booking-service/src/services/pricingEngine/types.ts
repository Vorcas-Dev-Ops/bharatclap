export interface PricingContext {
  userId: string;
  items: { subserviceId: string; quantity: number; price: number; categoryId?: string }[];
  timeSlot?: string; // e.g. "06:00 PM"
  scheduledDate?: Date;
  city?: string;
  couponCode?: string;
}

export interface RuleEvaluationResult {
  ruleName: string;
  ruleId?: string;
  pluginType: 'TIME_SLOT' | 'MEMBERSHIP' | 'COUPON' | 'SURGE' | 'HOLIDAY' | 'TAX';
  chargeDelta: number; // + for surcharge/tax, - for discount
  explainabilityText: string;
  rawRuleSnapshot?: any;
}

export interface IPricingRulePlugin {
  name: string;
  priority: number;
  evaluate(context: PricingContext, currentTotal: number): Promise<RuleEvaluationResult | null>;
}
