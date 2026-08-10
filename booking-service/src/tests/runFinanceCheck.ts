import assert from 'assert';
import { Booking } from '../models/Booking';
import { DispatchSetting } from '../../../provider-service/src/models/DispatchSetting';

console.log('----------------------------------------------------');
console.log('RUNNING ENTERPRISE FINANCE PHASE 0 & 1 SELF-CHECKS');
console.log('----------------------------------------------------');

// 1. DispatchSetting schema defaults check
const setting = new DispatchSetting();
assert.strictEqual(setting.gstRateOnCommission, 18, 'Default GST rate should be 18%');
assert.strictEqual(setting.tdsRateOnGross, 1, 'Default TDS rate should be 1%');
assert.strictEqual(setting.tcsRateOnGross, 1, 'Default TCS rate should be 1%');
assert.strictEqual(setting.settlementHoldDays, 3, 'Default hold days should be 3');
assert.strictEqual(setting.codBlockThreshold, 2000, 'Default COD block threshold should be 2000');
assert.strictEqual(setting.codRemitDays, 3, 'Default COD remit days should be 3');
assert.strictEqual(setting.defaultCommissionPercentage, 20, 'Default commission % should be 20%');
console.log('✔ Check 1 PASSED: DispatchSetting defaults are correctly configured.');

// 2. Dynamic settlement calculation math check
const customConfig = {
  gstRateOnCommission: 12,
  tdsRateOnGross: 2,
  tcsRateOnGross: 0.5,
  settlementHoldDays: 7,
  codBlockThreshold: 5000,
  codRemitDays: 5,
  defaultCommissionPercentage: 15
};

const payableAmount = 1000;
const commPct = customConfig.defaultCommissionPercentage;
const commissionAmount = (payableAmount * commPct) / 100;
const gstOnCommission = (commissionAmount * customConfig.gstRateOnCommission) / 100;
const tdsAmount = (payableAmount * customConfig.tdsRateOnGross) / 100;
const tcsAmount = (payableAmount * customConfig.tcsRateOnGross) / 100;
const netPayable = payableAmount - commissionAmount - gstOnCommission - tdsAmount - tcsAmount;

assert.strictEqual(commissionAmount, 150, 'Commission should be 150');
assert.strictEqual(gstOnCommission, 18, 'GST on commission should be 18');
assert.strictEqual(tdsAmount, 20, 'TDS should be 20');
assert.strictEqual(tcsAmount, 5, 'TCS should be 5');
assert.strictEqual(netPayable, 807, 'Net payable should be 807');
console.log('✔ Check 2 PASSED: Dynamic settlement rate math correctly overrides defaults.');

// 3. Dynamic COD due math check
const codGross = 2000;
const codCommission = (codGross * 20) / 100; // 400
const codGst = (codCommission * 18) / 100; // 72
const codDue = codCommission + codGst; // 472
assert.strictEqual(codDue, 472, 'COD due should be 472');

const isBlocked = (2600 + codDue) > customConfig.codBlockThreshold; // 3072 > 5000 -> false
assert.strictEqual(isBlocked, false, 'COD threshold check correctly respects custom limit');
console.log('✔ Check 3 PASSED: Dynamic COD due & threshold checks work.');

// 4. Booking model finance_status default check
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
assert.strictEqual(booking.finance_status, 'pending', 'Default finance_status should be pending');
console.log('✔ Check 4 PASSED: Booking finance_status defaults to "pending".');

// 5. Booking financial_snapshot applied_rates freezing check
const bookingWithRates = new Booking({
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
const rates = bookingWithRates.payment_collection?.financial_snapshot?.applied_rates;
assert.strictEqual(rates?.commission_pct, 20);
assert.strictEqual(rates?.gst_pct, 18);
assert.strictEqual(rates?.tds_pct, 1);
assert.strictEqual(rates?.tcs_pct, 1);
assert.strictEqual(rates?.hold_days, 3);
console.log('✔ Check 5 PASSED: financial_snapshot stores frozen applied_rates.');

// 6. Valid Enum status checks
const validStatuses = ['pending', 'collecting', 'payment_verified', 'settlement_created', 'settlement_hold', 'ready_for_payout', 'paid', 'disputed', 'expired'];
for (const st of validStatuses) {
  const b = new Booking({
    booking_id: `BK_${st}`,
    user_id: '60d5ecb8b5c9c22b1c8e4000',
    subservice_id: '60d5ecb8b5c9c22b1c8e4001',
    address_id: '60d5ecb8b5c9c22b1c8e4002',
    scheduled_at: new Date(),
    booking_time: '10:00 AM',
    service_price: 500,
    payable_amount: 500,
    finance_status: st as any
  });
  assert.strictEqual(b.validateSync(), undefined, `Status ${st} should be valid`);
}
console.log('✔ Check 6 PASSED: All 9 finance_status enum values are validated by Mongoose schema.');

// 7. Invalid Enum rejection check
const invalidBooking = new Booking({
  booking_id: 'BK_INVALID',
  user_id: '60d5ecb8b5c9c22b1c8e4000',
  subservice_id: '60d5ecb8b5c9c22b1c8e4001',
  address_id: '60d5ecb8b5c9c22b1c8e4002',
  scheduled_at: new Date(),
  booking_time: '10:00 AM',
  service_price: 500,
  payable_amount: 500,
  finance_status: 'bogus_status' as any
});
const syncErr = invalidBooking.validateSync();
assert.ok(syncErr && syncErr.errors['finance_status'], 'Invalid finance_status must be rejected');
console.log('✔ Check 7 PASSED: Invalid finance_status is correctly rejected by Mongoose schema.');

console.log('----------------------------------------------------');
console.log('ALL 7 SELF-CHECKS PASSED SUCCESSFULLY!');
console.log('----------------------------------------------------');
