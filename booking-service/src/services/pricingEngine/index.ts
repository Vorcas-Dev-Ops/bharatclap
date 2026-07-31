import crypto from 'crypto';
import { PricingContext, IPricingRulePlugin, RuleEvaluationResult } from './types';
import { getActiveMembershipFeatures, getCatalogBatch } from '../../utils/internalApi';
import axios from 'axios';

const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://127.0.0.1:5002';
const DEFAULT_INTERNAL_KEY = '2a6c1e55ff67db6dfde863d08f7fbdf9435b5463ff868bdcf0eb3d08c5c709e2';

export class TimeSlotRulePlugin implements IPricingRulePlugin {
  name = 'TimeSlotRulePlugin';
  priority = 100;

  async evaluate(context: PricingContext, currentTotal: number): Promise<RuleEvaluationResult | null> {
    if (!context.timeSlot) return null;

    try {
      const categoryId = context.items[0]?.categoryId || '';
      const subserviceId = context.items[0]?.subserviceId || '';
      const queryParams = new URLSearchParams({
        slotTime: context.timeSlot,
        basePrice: String(currentTotal),
        categoryId,
        subserviceId,
        city: context.city || '',
        date: (context.scheduledDate || new Date()).toISOString()
      });

      const res = await axios.post(`${CATALOG_SERVICE_URL}/api/timeslot-rules/admin/simulate`, {
        slotTime: context.timeSlot,
        basePrice: currentTotal,
        categoryId,
        subserviceId,
        city: context.city,
        date: context.scheduledDate
      }, {
        headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || DEFAULT_INTERNAL_KEY },
        timeout: 3000
      });

      if (res.status === 200 && res.data?.evaluation) {
        const evalData = res.data.evaluation;
        const netDelta = evalData.netSlotSurcharge || 0;
        if (netDelta === 0 && evalData.appliedRules.length === 0) return null;

        return {
          ruleName: evalData.appliedRules[0]?.ruleName || 'Time Slot Surcharge',
          ruleId: evalData.appliedRules[0]?.ruleId,
          pluginType: 'TIME_SLOT',
          chargeDelta: netDelta,
          explainabilityText: `Time Slot (${context.timeSlot}): ${netDelta >= 0 ? '+' : ''}₹${netDelta}`,
          rawRuleSnapshot: evalData.appliedRules
        };
      }
    } catch (err) {
      console.warn('[TimeSlotRulePlugin] Catalog evaluation failed or fallback engaged:', err);
    }
    return null;
  }
}

export class MembershipRulePlugin implements IPricingRulePlugin {
  name = 'MembershipRulePlugin';
  priority = 80;

  async evaluate(context: PricingContext, currentTotal: number): Promise<RuleEvaluationResult | null> {
    if (!context.userId) return null;

    try {
      const membership = await getActiveMembershipFeatures(context.userId);
      if (membership && membership.discountPercentage > 0) {
        const discountAmount = Math.round((currentTotal * membership.discountPercentage) / 100);
        return {
          ruleName: `Membership Discount (${membership.discountPercentage}%)`,
          pluginType: 'MEMBERSHIP',
          chargeDelta: -discountAmount,
          explainabilityText: `VIP Membership (-${membership.discountPercentage}%): -₹${discountAmount}`,
          rawRuleSnapshot: membership
        };
      }
    } catch (err) {
      console.warn('[MembershipRulePlugin] Failed to fetch membership:', err);
    }
    return null;
  }
}

export class CouponRulePlugin implements IPricingRulePlugin {
  name = 'CouponRulePlugin';
  priority = 60;

  async evaluate(context: PricingContext, currentTotal: number): Promise<RuleEvaluationResult | null> {
    if (!context.couponCode) return null;

    try {
      const subserviceIds = context.items.map(i => i.subserviceId);
      const catalogData = await getCatalogBatch(subserviceIds, [], [], [context.couponCode]);
      const coupon = catalogData.coupons?.find((c: any) => c.code === context.couponCode);

      if (coupon && coupon.status === 'active' && new Date() <= new Date(coupon.expiryDate)) {
        if (currentTotal >= coupon.minOrderAmount) {
          let discount = 0;
          if (coupon.discountType === 'percentage') {
            discount = (currentTotal * coupon.discountValue) / 100;
            if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
              discount = coupon.maxDiscountAmount;
            }
          } else {
            discount = coupon.discountValue;
          }
          discount = Math.round(discount);
          return {
            ruleName: `Coupon (${coupon.code})`,
            pluginType: 'COUPON',
            chargeDelta: -discount,
            explainabilityText: `Coupon ${coupon.code}: -₹${discount}`,
            rawRuleSnapshot: coupon
          };
        }
      }
    } catch (err) {
      console.warn('[CouponRulePlugin] Failed to evaluate coupon:', err);
    }
    return null;
  }
}

export class TaxRulePlugin implements IPricingRulePlugin {
  name = 'TaxRulePlugin';
  priority = 10;

  async evaluate(context: PricingContext, currentTotal: number): Promise<RuleEvaluationResult | null> {
    // Standard GST @ 18% on taxable subtotal
    const gstRate = 0.18;
    const taxAmount = Math.round(currentTotal * gstRate);
    return {
      ruleName: 'GST (18%)',
      pluginType: 'TAX',
      chargeDelta: taxAmount,
      explainabilityText: `GST @ 18%: +₹${taxAmount}`
    };
  }
}

export class GenericPricingEngine {
  private plugins: IPricingRulePlugin[] = [
    new TimeSlotRulePlugin(),
    new MembershipRulePlugin(),
    new CouponRulePlugin(),
    new TaxRulePlugin()
  ];

  public generateHMAC(quoteData: any): string {
    const secret = process.env.JWT_SECRET || 'antigravity_pricing_secret_key';
    const payload = JSON.stringify({
      subtotal: quoteData.subtotal,
      final_total: quoteData.final_total,
      slot_charge: quoteData.slot_charge,
      items: quoteData.items
    });
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  public async calculateQuote(context: PricingContext) {
    const startTime = Date.now();

    const itemsSummary = context.items.map(item => ({
      subservice_id: item.subserviceId,
      quantity: item.quantity,
      base_price: item.price,
      subtotal: item.price * item.quantity
    }));

    const baseSubtotal = itemsSummary.reduce((acc, i) => acc + i.subtotal, 0);
    let runningTotal = baseSubtotal;

    const explainabilityTrace: any[] = [];
    const appliedRules: any[] = [];

    let slotCharge = 0;
    let membershipDiscount = 0;
    let couponDiscount = 0;
    let taxAmount = 0;

    // Run plugins ordered by priority
    const sortedPlugins = [...this.plugins].sort((a, b) => b.priority - a.priority);

    for (const plugin of sortedPlugins) {
      const before = runningTotal;
      const res = await plugin.evaluate(context, runningTotal);

      if (res && res.chargeDelta !== 0) {
        runningTotal += res.chargeDelta;
        if (runningTotal < 0) runningTotal = 0;

        explainabilityTrace.push({
          step: plugin.name,
          description: res.explainabilityText,
          before,
          change: res.chargeDelta,
          after: runningTotal,
          ruleId: res.ruleId,
          ruleName: res.ruleName,
          timestamp: new Date()
        });

        appliedRules.push(res);

        if (res.pluginType === 'TIME_SLOT') slotCharge += res.chargeDelta;
        if (res.pluginType === 'MEMBERSHIP') membershipDiscount += Math.abs(res.chargeDelta);
        if (res.pluginType === 'COUPON') couponDiscount += Math.abs(res.chargeDelta);
        if (res.pluginType === 'TAX') taxAmount += res.chargeDelta;
      }
    }

    const calculationTimeMs = Date.now() - startTime;
    const finalTotal = Math.round(runningTotal);

    const quoteData = {
      subtotal: baseSubtotal,
      slot_charge: slotCharge,
      membership_discount: membershipDiscount,
      coupon_discount: couponDiscount,
      tax_amount: taxAmount,
      final_total: finalTotal,
      items: itemsSummary,
      pricingSnapshot: {
        appliedRules,
        explainabilityTrace,
        rulesVersion: 1,
        quoteCreatedAt: new Date(),
        calculationTimeMs
      }
    };

    const hmacSignature = this.generateHMAC(quoteData);

    return {
      ...quoteData,
      hmacSignature
    };
  }
}

export const pricingEngine = new GenericPricingEngine();
