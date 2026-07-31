import { evaluateTimeSlotRules } from '../../../catalog-service/src/services/ruleEvaluationService';
import { GenericPricingEngine } from '../services/pricingEngine';

describe('Enterprise Pricing Engine & TimeSlot Rule Evaluation Tests', () => {
  const mockRules: any[] = [
    {
      _id: 'rule1',
      ruleName: 'Peak Evening Surge',
      pricingType: 'FIXED_SURCHARGE',
      startTime: '18:00',
      endTime: '21:00',
      extraCharge: 100,
      priority: 100,
      isStackable: true,
      isExclusive: false,
      isActive: true,
      status: 'active',
      version: 1
    },
    {
      _id: 'rule2',
      ruleName: 'Morning Deal',
      pricingType: 'PERCENTAGE_DISCOUNT',
      startTime: '08:00',
      endTime: '10:00',
      extraCharge: 10, // 10%
      priority: 50,
      isStackable: true,
      isExclusive: false,
      isActive: true,
      status: 'active',
      version: 1
    }
  ];

  test('1. Correctly calculates peak hour fixed surcharge (+100)', () => {
    const res = evaluateTimeSlotRules(mockRules, {
      slotTime: '18:30',
      basePrice: 1000
    });

    expect(res.netSlotSurcharge).toBe(100);
    expect(res.appliedRules.length).toBe(1);
    expect(res.appliedRules[0].ruleName).toBe('Peak Evening Surge');
  });

  test('2. Correctly calculates percentage discount (-10% on 1000)', () => {
    const res = evaluateTimeSlotRules(mockRules, {
      slotTime: '09:00',
      basePrice: 1000
    });

    expect(res.netSlotSurcharge).toBe(-100);
    expect(res.totalDiscount).toBe(100);
  });

  test('3. Ignores expired or inactive rules', () => {
    const inactiveRules = [
      { ...mockRules[0], isActive: false, status: 'disabled' }
    ];
    const res = evaluateTimeSlotRules(inactiveRules, {
      slotTime: '18:30',
      basePrice: 1000
    });

    expect(res.netSlotSurcharge).toBe(0);
    expect(res.appliedRules.length).toBe(0);
  });

  test('4. GenericPricingEngine generates valid HMAC signature', () => {
    const engine = new GenericPricingEngine();
    const sampleQuote = {
      subtotal: 1000,
      slot_charge: 100,
      final_total: 1100,
      items: [{ subservice_id: 'sub1', quantity: 1, base_price: 1000, subtotal: 1000 }]
    };

    const sig1 = engine.generateHMAC(sampleQuote);
    const sig2 = engine.generateHMAC(sampleQuote);

    expect(sig1).toBeTruthy();
    expect(typeof sig1).toBe('string');
    expect(sig1).toBe(sig2);
  });
});
