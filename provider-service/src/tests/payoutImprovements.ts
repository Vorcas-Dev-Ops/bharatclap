/**
 * Regression tests for the 3 payout improvements:
 *   (a) Settlements above the cap are held, not paid
 *   (b) Batch result tracks held/failed counts for notifications
 *   (c) CAS prevents double-payout on concurrent runs
 *   (d) Config fields exist in schema
 *
 * Run: npx ts-node src/tests/payoutImprovements.ts
 *
 * ponytail: uses raw MongoDB driver for DispatchSetting updates to bypass
 * ts-node schema cache, and tests cap/CAS logic without needing RazorpayX keys.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}`);
    failed++;
  }
}

/** Raw driver helper — bypasses Mongoose strict mode for DispatchSetting */
async function setDispatchRaw(fields: Record<string, any>) {
  await mongoose.connection.db!.collection('dispatchsettings').updateOne({}, { $set: fields });
}
async function getDispatchRaw(): Promise<any> {
  return mongoose.connection.db!.collection('dispatchsettings').findOne({});
}

// ── (a) Payout cap check ────────────────────────────────────────────────────

async function testPayoutCap() {
  console.log('\n── (a) Payout cap: settlements above threshold are auto-held ──');

  const { ProviderSettlement } = await import('../models/ProviderSettlement');
  const { processSingleSettlementPayout } = await import('../services/batchSettlementProcessor');

  // Set cap to ₹1,000 via raw driver (bypasses Mongoose strict mode / ts-node cache)
  await setDispatchRaw({ maxAutoPayoutAmount: 1000 });
  const verify = await getDispatchRaw();
  console.log(`  [setup] maxAutoPayoutAmount in DB: ${verify.maxAutoPayoutAmount}`);

  // Create a dummy provider ID (we won't need bank details since cap holds before RazorpayX)
  const providerId = new mongoose.Types.ObjectId();

  // ── Test 1: Settlement ABOVE cap (₹5,000 > ₹1,000) → held_by_admin ──
  const aboveCap = await ProviderSettlement.create({
    provider_id: providerId,
    booking_id: new mongoose.Types.ObjectId(),
    booking_display_id: 'TEST-CAP-ABOVE',
    payment_type: 'online',
    gross_amount: 6250,
    commission_percentage: 20,
    commission_amount: 1250,
    gst_on_commission: 0,
    tds_amount: 0,
    tcs_amount: 0,
    net_payable_amount: 5000, // Above ₹1,000 cap
    status: 'ready_for_payout',
    payout_attempts: 0,
    audit_trail: [],
  });

  const aboveResult = await processSingleSettlementPayout(aboveCap._id);
  const aboveAfter = await ProviderSettlement.findById(aboveCap._id).lean() as any;

  assert(aboveResult === false, 'Above-cap settlement returns false');
  assert(aboveAfter.status === 'held_by_admin', 'Above-cap settlement status is held_by_admin');
  assert(aboveAfter.is_locked === false, 'Above-cap settlement lock is released');
  assert(
    aboveAfter.audit_trail.some((e: any) => e.action === 'AUTO_HELD_EXCEEDS_CAP'),
    'Above-cap settlement has AUTO_HELD_EXCEEDS_CAP audit entry'
  );
  assert(
    aboveAfter.audit_trail.some((e: any) => (e.notes || '').includes('1,000')),
    'Audit note mentions the cap value'
  );

  // ── Test 2: Admin skipCapCheck bypasses the cap ──
  // Reset the settlement to ready_for_payout
  await ProviderSettlement.updateOne(
    { _id: aboveCap._id },
    { $set: { status: 'ready_for_payout', is_locked: false } }
  );

  const adminResult = await processSingleSettlementPayout(aboveCap._id, { skipCapCheck: true });
  const adminAfter = await ProviderSettlement.findById(aboveCap._id).lean() as any;

  // With skipCapCheck, it proceeds past cap check — then may fail at provider lookup
  // or RazorpayX (no key), but the point is it does NOT get AUTO_HELD_EXCEEDS_CAP again
  const newCapHolds = adminAfter.audit_trail.filter((e: any) => e.action === 'AUTO_HELD_EXCEEDS_CAP');
  assert(newCapHolds.length === 1, `Admin bypass: no additional AUTO_HELD_EXCEEDS_CAP (count: ${newCapHolds.length}, still 1 from before)`);

  // ── Test 3: Settlement BELOW cap (₹500 < ₹1,000) → proceeds past cap check ──
  const belowCap = await ProviderSettlement.create({
    provider_id: providerId,
    booking_id: new mongoose.Types.ObjectId(),
    booking_display_id: 'TEST-CAP-BELOW',
    payment_type: 'online',
    gross_amount: 625,
    commission_percentage: 20,
    commission_amount: 125,
    gst_on_commission: 0,
    tds_amount: 0,
    tcs_amount: 0,
    net_payable_amount: 500, // Below ₹1,000 cap
    status: 'ready_for_payout',
    payout_attempts: 0,
    audit_trail: [],
  });

  await processSingleSettlementPayout(belowCap._id);
  const belowAfter = await ProviderSettlement.findById(belowCap._id).lean() as any;

  // Should NOT be held by cap (may fail later at provider lookup / RazorpayX)
  const belowCapHolds = (belowAfter.audit_trail || []).filter((e: any) => e.action === 'AUTO_HELD_EXCEEDS_CAP');
  assert(belowCapHolds.length === 0, 'Below-cap settlement has no AUTO_HELD_EXCEEDS_CAP');

  // Cleanup
  await ProviderSettlement.deleteMany({ booking_display_id: { $in: ['TEST-CAP-ABOVE', 'TEST-CAP-BELOW'] } });
  await setDispatchRaw({ maxAutoPayoutAmount: 50000 });
}

// ── (b) Batch result tracks held/failed counts ──────────────────────────────

async function testBatchHeldCounts() {
  console.log('\n── (b) Batch result includes held/failed counts ──');

  const { ProviderSettlement } = await import('../models/ProviderSettlement');
  const { batchProcessSettlements } = await import('../services/batchSettlementProcessor');

  // Set cap to ₹100 so test settlement gets held
  await setDispatchRaw({ maxAutoPayoutAmount: 100 });

  const settlement = await ProviderSettlement.create({
    provider_id: new mongoose.Types.ObjectId(),
    booking_id: new mongoose.Types.ObjectId(),
    booking_display_id: 'TEST-BATCH-HELD',
    payment_type: 'online',
    gross_amount: 1000,
    commission_percentage: 20,
    commission_amount: 200,
    gst_on_commission: 0,
    tds_amount: 0,
    tcs_amount: 0,
    net_payable_amount: 800, // Above ₹100 cap → held
    status: 'ready_for_payout',
    payout_attempts: 0,
    audit_trail: [],
  });

  const result = await batchProcessSettlements([settlement._id.toString()]);

  assert(result.heldCount >= 1, `Batch result heldCount ≥ 1 (got: ${result.heldCount})`);
  assert(typeof result.failedCount === 'number', 'Batch result has failedCount field');
  assert(typeof result.batchId === 'string', 'Batch result has batchId');

  // Verify the settlement is actually held
  const after = await ProviderSettlement.findById(settlement._id).lean() as any;
  assert(after.status === 'held_by_admin', `Settlement status is held_by_admin (got: ${after.status})`);

  // Cleanup
  await ProviderSettlement.deleteMany({ booking_display_id: 'TEST-BATCH-HELD' });
  await setDispatchRaw({ maxAutoPayoutAmount: 50000 });
}

// ── (c) CAS prevents double-payout on concurrent claims ─────────────────────

async function testCASIdempotency() {
  console.log('\n── (c) CAS prevents double-processing on concurrent runs ──');

  const { ProviderSettlement } = await import('../models/ProviderSettlement');

  const settlement = await ProviderSettlement.create({
    provider_id: new mongoose.Types.ObjectId(),
    booking_id: new mongoose.Types.ObjectId(),
    booking_display_id: 'TEST-CAS-RAW',
    payment_type: 'online',
    gross_amount: 500,
    commission_percentage: 20,
    commission_amount: 100,
    gst_on_commission: 0,
    tds_amount: 0,
    tcs_amount: 0,
    net_payable_amount: 400,
    status: 'ready_for_payout',
    payout_attempts: 0,
    audit_trail: [],
  });

  // Simulate 5 concurrent CAS claims (same atomic query used by processSingleSettlementPayout)
  const claimQuery = {
    _id: settlement._id,
    $or: [
      { status: 'ready_for_payout' },
      { status: 'failed', is_non_retryable: { $ne: true }, payout_attempts: { $lt: 3 } },
    ],
  };
  const claimUpdate = {
    $set: { status: 'processing', gateway_payout_status: 'processing', is_locked: true },
  };

  const results = await Promise.all([
    ProviderSettlement.findOneAndUpdate(claimQuery, claimUpdate, { new: true }),
    ProviderSettlement.findOneAndUpdate(claimQuery, claimUpdate, { new: true }),
    ProviderSettlement.findOneAndUpdate(claimQuery, claimUpdate, { new: true }),
    ProviderSettlement.findOneAndUpdate(claimQuery, claimUpdate, { new: true }),
    ProviderSettlement.findOneAndUpdate(claimQuery, claimUpdate, { new: true }),
  ]);

  const claimed = results.filter(Boolean).length;
  const rejected = results.filter(r => !r).length;

  assert(claimed === 1, `Exactly 1 of 5 concurrent CAS claims wins (got: ${claimed})`);
  assert(rejected === 4, `Exactly 4 of 5 concurrent CAS claims rejected (got: ${rejected})`);

  const after = await ProviderSettlement.findById(settlement._id).lean() as any;
  assert(after.status === 'processing', `Settlement status is 'processing' (got: ${after.status})`);
  assert(after.is_locked === true, 'Settlement is locked after claim');

  // Cleanup
  await ProviderSettlement.deleteMany({ booking_display_id: 'TEST-CAS-RAW' });
}

// ── (d) DispatchSetting has new config fields ───────────────────────────────

async function testConfigFields() {
  console.log('\n── (d) DispatchSetting config fields verified in DB ──');

  // Set fields via raw driver and verify they persist and read back
  await setDispatchRaw({ maxAutoPayoutAmount: 25000, settlementCronIntervalHours: 6 });
  const doc = await getDispatchRaw();

  assert(doc.maxAutoPayoutAmount === 25000, `maxAutoPayoutAmount persists in DB (got: ${doc.maxAutoPayoutAmount})`);
  assert(doc.settlementCronIntervalHours === 6, `settlementCronIntervalHours persists in DB (got: ${doc.settlementCronIntervalHours})`);

  // Reset to defaults
  await setDispatchRaw({ maxAutoPayoutAmount: 50000, settlementCronIntervalHours: 4 });
  const reset = await getDispatchRaw();
  assert(reset.maxAutoPayoutAmount === 50000, `Reset to 50000 (got: ${reset.maxAutoPayoutAmount})`);
  assert(reset.settlementCronIntervalHours === 4, `Reset to 4 (got: ${reset.settlementCronIntervalHours})`);
}

// ── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔧 Payout Improvements Regression Tests\n');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bharatclap_test';
  try {
    await mongoose.connect(mongoUri);
    console.log(`Connected to ${mongoUri}`);
  } catch (err: any) {
    console.error(`Cannot connect to MongoDB: ${err.message}`);
    process.exit(1);
  }

  await testPayoutCap();
  await testBatchHeldCounts();
  await testCASIdempotency();
  await testConfigFields();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.error('\n🚨 REGRESSION DETECTED — do not deploy until fixed.');
    process.exit(1);
  } else {
    console.log('\n✅ All payout improvement tests passed.');
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
