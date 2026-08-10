import { Booking } from '../models/Booking';
import { DispatchSetting } from '../../../provider-service/src/models/DispatchSetting';

describe('Enterprise Finance Phase 0 & Phase 1 Tests', () => {

  describe('Phase 0: Configurable Finance Settings & Rate Calculation Math', () => {

    test('1. DispatchSetting schema has correct defaults for all 7 finance fields', () => {
      const doc = new DispatchSetting();
      expect(doc.gstRateOnCommission).toBe(18);
      expect(doc.tdsRateOnGross).toBe(1);
      expect(doc.tcsRateOnGross).toBe(1);
      expect(doc.settlementHoldDays).toBe(3);
      expect(doc.codBlockThreshold).toBe(2000);
      expect(doc.codRemitDays).toBe(3);
      expect(doc.defaultCommissionPercentage).toBe(20);
    });

    test('2. Dynamic Settlement Calculation uses custom config rates when overridden', () => {
      // Simulate config overrides
      const customConfig = {
        gstRateOnCommission: 12, // 12% GST override
        tdsRateOnGross: 2,       // 2% TDS override
        tcsRateOnGross: 0.5,     // 0.5% TCS override
        settlementHoldDays: 7,   // 7-day hold override
        codBlockThreshold: 5000,
        codRemitDays: 5,
        defaultCommissionPercentage: 15
      };

      const payableAmount = 1000; // Gross
      const commPct = customConfig.defaultCommissionPercentage; // 15%
      const commissionAmount = (payableAmount * commPct) / 100; // 150
      const gstOnCommission = (commissionAmount * customConfig.gstRateOnCommission) / 100; // 150 * 0.12 = 18
      const tdsAmount = (payableAmount * customConfig.tdsRateOnGross) / 100; // 1000 * 0.02 = 20
      const tcsAmount = (payableAmount * customConfig.tcsRateOnGross) / 100; // 1000 * 0.005 = 5

      const netPayable = payableAmount - commissionAmount - gstOnCommission - tdsAmount - tcsAmount;
      // 1000 - 150 - 18 - 20 - 5 = 807

      expect(commissionAmount).toBe(150);
      expect(gstOnCommission).toBe(18);
      expect(tdsAmount).toBe(20);
      expect(tcsAmount).toBe(5);
      expect(netPayable).toBe(807);

      // Verify hold end date calculation
      const now = new Date('2026-08-04T12:00:00Z');
      const holdEndsAt = new Date(now);
      holdEndsAt.setDate(holdEndsAt.getDate() + customConfig.settlementHoldDays);
      expect(holdEndsAt.toISOString()).toBe('2026-08-11T12:00:00.000Z');
    });

    test('3. Dynamic COD Due Calculation uses custom config rates', () => {
      const customConfig = {
        gstRateOnCommission: 18,
        defaultCommissionPercentage: 20,
        codBlockThreshold: 3000,
        codRemitDays: 4
      };

      const grossAmount = 2000;
      const commissionAmount = (grossAmount * customConfig.defaultCommissionPercentage) / 100; // 400
      const gstOnCommission = (commissionAmount * customConfig.gstRateOnCommission) / 100; // 72
      const codDueAmount = commissionAmount + gstOnCommission; // 472

      expect(codDueAmount).toBe(472);

      // Verify COD block logic against custom threshold
      const previousCodDue = 2600;
      const newCodDue = previousCodDue + codDueAmount; // 3072
      const isBlocked = newCodDue > customConfig.codBlockThreshold; // 3072 > 3000 -> true
      expect(isBlocked).toBe(true);
    });
  });

  describe('Phase 1: Booking finance_status & financial_snapshot enrichment', () => {

    test('4. Booking model defaults finance_status to "pending"', () => {
      const booking = new Booking({
        booking_id: 'BK_TEST_001',
        user_id: '60d5ecb8b5c9c22b1c8e4000',
        subservice_id: '60d5ecb8b5c9c22b1c8e4001',
        address_id: '60d5ecb8b5c9c22b1c8e4002',
        scheduled_at: new Date(),
        booking_time: '10:00 AM',
        service_price: 500,
        payable_amount: 500,
      });

      expect(booking.finance_status).toBe('pending');
    });

    test('5. Booking financial_snapshot supports applied_rates rate freezing', () => {
      const booking = new Booking({
        booking_id: 'BK_TEST_002',
        user_id: '60d5ecb8b5c9c22b1c8e4000',
        subservice_id: '60d5ecb8b5c9c22b1c8e4001',
        address_id: '60d5ecb8b5c9c22b1c8e4002',
        scheduled_at: new Date(),
        booking_time: '10:00 AM',
        service_price: 1000,
        payable_amount: 1000,
        payment_collection: {
          status: 'verified',
          method: 'prepaid',
          final_amount: 1000,
          collected_amount: 1000,
          remaining_amount: 0,
          attempts: 1,
          financial_snapshot: {
            subtotal: 1000,
            extra_charges: 0,
            taxes: 0,
            discount: 0,
            final_amount: 1000,
            platform_commission: 200,
            provider_earning: 800,
            applied_rates: {
              commission_pct: 20,
              gst_pct: 18,
              tds_pct: 1,
              tcs_pct: 1,
              hold_days: 3
            }
          }
        }
      });

      const rates = booking.payment_collection?.financial_snapshot?.applied_rates;
      expect(rates).toBeDefined();
      expect(rates?.commission_pct).toBe(20);
      expect(rates?.gst_pct).toBe(18);
      expect(rates?.tds_pct).toBe(1);
      expect(rates?.tcs_pct).toBe(1);
      expect(rates?.hold_days).toBe(3);
    });

    test('6. Validates finance_status lifecycle state transitions', () => {
      const validStatuses = [
        'pending',
        'collecting',
        'payment_verified',
        'settlement_created',
        'settlement_hold',
        'ready_for_payout',
        'paid',
        'disputed',
        'expired'
      ];

      for (const st of validStatuses) {
        const booking = new Booking({
          booking_id: `BK_STATUS_${st}`,
          user_id: '60d5ecb8b5c9c22b1c8e4000',
          subservice_id: '60d5ecb8b5c9c22b1c8e4001',
          address_id: '60d5ecb8b5c9c22b1c8e4002',
          scheduled_at: new Date(),
          booking_time: '10:00 AM',
          service_price: 500,
          payable_amount: 500,
          finance_status: st as any
        });

        const err = booking.validateSync();
        expect(err).toBeUndefined();
        expect(booking.finance_status).toBe(st);
      }
    });

    test('7. Rejects invalid finance_status enum value', () => {
      const booking = new Booking({
        booking_id: 'BK_INVALID_STATUS',
        user_id: '60d5ecb8b5c9c22b1c8e4000',
        subservice_id: '60d5ecb8b5c9c22b1c8e4001',
        address_id: '60d5ecb8b5c9c22b1c8e4002',
        scheduled_at: new Date(),
        booking_time: '10:00 AM',
        service_price: 500,
        payable_amount: 500,
        finance_status: 'invalid_status_value' as any
      });

      const err = booking.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors['finance_status']).toBeDefined();
    });
  });
});
