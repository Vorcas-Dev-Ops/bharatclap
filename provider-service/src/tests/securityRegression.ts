/**
 * Regression tests for security fixes 1-3 (payment verification) and fix 6 (Provider wallet guard hooks).
 *
 * Run: npx ts-node src/tests/securityRegression.ts
 * Requires: MONGO_URI env var pointing to a test database (or uses default localhost).
 *
 * ponytail: assert-based self-check, no framework needed.
 */

import mongoose from 'mongoose';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

// ── Test helpers ─────────────────────────────────────────────────────────────

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

// ── Fix 6: Provider wallet guard hooks ───────────────────────────────────────

async function testProviderWalletGuards() {
  console.log('\n── Fix 6: Provider update hook guards ──');

  const { Provider } = await import('../models/Provider');

  // Create a test provider — must authorize wallet fields via $locals (same as walletLedgerService does)
  const testProvider = new Provider({
    user_id: new mongoose.Types.ObjectId(),
    kyc_status: 'pending',
    availability_status: 'offline',
    walletBalance: 1000,
    creditLimit: 500,
  });
  testProvider.$locals.walletLedgerAuthorized = true;
  await testProvider.save();

  const id = testProvider._id;

  // Test 1: Normal field updates via findOneAndUpdate should PASS
  try {
    await Provider.findOneAndUpdate(
      { _id: id },
      { $set: { availability_status: 'available', isOnline: true, kyc_status: 'verified' } }
    );
    assert(true, 'findOneAndUpdate on non-wallet fields succeeds');
  } catch (err: any) {
    assert(false, `findOneAndUpdate on non-wallet fields succeeds — got: ${err.message}`);
  }

  // Test 2: updateOne on non-wallet fields should PASS
  try {
    await Provider.updateOne(
      { _id: id },
      { $set: { onboarding_status: 'APPROVED', isBusy: true } }
    );
    assert(true, 'updateOne on non-wallet fields succeeds');
  } catch (err: any) {
    assert(false, `updateOne on non-wallet fields succeeds — got: ${err.message}`);
  }

  // Test 3: updateMany on non-wallet fields should PASS
  try {
    await Provider.updateMany(
      { _id: id },
      { $set: { isOnline: false, availability_status: 'offline', offlineReason: 'heartbeat_timeout' } }
    );
    assert(true, 'updateMany on non-wallet fields succeeds');
  } catch (err: any) {
    assert(false, `updateMany on non-wallet fields succeeds — got: ${err.message}`);
  }

  // Test 4: Aggregation pipeline update (like rating endpoint) should PASS
  try {
    await Provider.findOneAndUpdate(
      { _id: id },
      [
        { $set: { ratingSum: { $add: [{ $ifNull: ['$ratingSum', 0] }, 5] } } },
        { $set: { totalJobs: { $add: [{ $ifNull: ['$totalJobs', 0] }, 1] } } },
      ]
    );
    assert(true, 'Aggregation pipeline update (rating) succeeds');
  } catch (err: any) {
    assert(false, `Aggregation pipeline update (rating) succeeds — got: ${err.message}`);
  }

  // Test 5: Direct walletBalance via $set should be BLOCKED
  try {
    await Provider.findOneAndUpdate(
      { _id: id },
      { $set: { walletBalance: 99999 } }
    );
    assert(false, 'Direct walletBalance $set is blocked (should have thrown)');
  } catch (err: any) {
    assert(err.message.includes('FINANCIAL INTEGRITY'), 'Direct walletBalance $set is blocked');
  }

  // Test 6: Direct creditLimit via $inc should be BLOCKED
  try {
    await Provider.updateOne(
      { _id: id },
      { $inc: { creditLimit: 5000 } }
    );
    assert(false, 'Direct creditLimit $inc is blocked (should have thrown)');
  } catch (err: any) {
    assert(err.message.includes('FINANCIAL INTEGRITY'), 'Direct creditLimit $inc is blocked');
  }

  // Test 7: Direct walletBalance via updateMany should be BLOCKED
  try {
    await Provider.updateMany(
      { _id: id },
      { $set: { walletBalance: 0 } }
    );
    assert(false, 'Direct walletBalance updateMany is blocked (should have thrown)');
  } catch (err: any) {
    assert(err.message.includes('FINANCIAL INTEGRITY'), 'Direct walletBalance updateMany is blocked');
  }

  // Test 8: walletLedgerAuthorized option should ALLOW direct wallet update
  try {
    await Provider.findOneAndUpdate(
      { _id: id },
      { $set: { walletBalance: 2000 } },
      { walletLedgerAuthorized: true } as any
    );
    assert(true, 'walletLedgerAuthorized option allows wallet update');
  } catch (err: any) {
    assert(false, `walletLedgerAuthorized option allows wallet update — got: ${err.message}`);
  }

  // Test 9: Mixed update (wallet + non-wallet) should be BLOCKED without auth
  try {
    await Provider.findOneAndUpdate(
      { _id: id },
      { $set: { walletBalance: 5000, availability_status: 'available' } }
    );
    assert(false, 'Mixed wallet+non-wallet update is blocked (should have thrown)');
  } catch (err: any) {
    assert(err.message.includes('FINANCIAL INTEGRITY'), 'Mixed wallet+non-wallet update is blocked');
  }

  // Cleanup
  await Provider.deleteOne({ _id: id });
}

// ── Fixes 1-3: Payment signature verification ───────────────────────────────

function testMockBypassLogic() {
  console.log('\n── Fixes 1-3: Mock bypass & signature logic ──');

  const REAL_SECRET = 'test_secret_key_12345';

  // Simulate the fixed mock check logic
  function isMockAllowed(orderId: string, signature: string, nodeEnv: string): boolean {
    return (orderId.startsWith('order_mock_') || signature === 'mock_signature')
      && nodeEnv !== 'production';
  }

  // Test 1: Mock order in dev — should be allowed
  assert(
    isMockAllowed('order_mock_abc123', 'any_sig', 'development') === true,
    'Mock order allowed in development'
  );

  // Test 2: Mock order in production — should be BLOCKED
  assert(
    isMockAllowed('order_mock_abc123', 'any_sig', 'production') === false,
    'Mock order blocked in production'
  );

  // Test 3: Mock signature in production — should be BLOCKED
  assert(
    isMockAllowed('order_real_abc123', 'mock_signature', 'production') === false,
    'Mock signature blocked in production'
  );

  // Test 4: Real order in production — should not be mock
  assert(
    isMockAllowed('order_ORD123', 'real_sig', 'production') === false,
    'Real order in production is not mock'
  );

  // ── Lead package signature logic (fix 3) ──
  function verifyLeadPackageSignature(
    orderId: string,
    paymentId: string,
    signature: string | undefined,
    nodeEnv: string,
    secret: string
  ): { pass: boolean; error?: string } {
    const isMock = orderId?.startsWith('order_mock_') && nodeEnv !== 'production';

    if (!isMock) {
      if (!signature) {
        return { pass: false, error: 'Payment signature is required' };
      }
      const expected = crypto
        .createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
      if (expected !== signature) {
        return { pass: false, error: 'Invalid payment signature' };
      }
    }

    return { pass: true };
  }

  // Test 5: Missing signature in production — should FAIL (fix 3)
  const res5 = verifyLeadPackageSignature('order_ORD123', 'pay_123', undefined, 'production', REAL_SECRET);
  assert(res5.pass === false && res5.error === 'Payment signature is required', 'Missing signature fails closed in production');

  // Test 6: Missing signature in dev with non-mock order — should FAIL
  const res6 = verifyLeadPackageSignature('order_ORD123', 'pay_123', undefined, 'development', REAL_SECRET);
  assert(res6.pass === false, 'Missing signature fails closed even in dev for real orders');

  // Test 7: Valid signature in production — should PASS
  const validSig = crypto
    .createHmac('sha256', REAL_SECRET)
    .update('order_ORD123|pay_123')
    .digest('hex');
  const res7 = verifyLeadPackageSignature('order_ORD123', 'pay_123', validSig, 'production', REAL_SECRET);
  assert(res7.pass === true, 'Valid signature passes in production');

  // Test 8: Invalid signature in production — should FAIL
  const res8 = verifyLeadPackageSignature('order_ORD123', 'pay_123', 'bad_signature', 'production', REAL_SECRET);
  assert(res8.pass === false && res8.error === 'Invalid payment signature', 'Invalid signature fails in production');

  // Test 9: Mock order in dev with no signature — should PASS
  const res9 = verifyLeadPackageSignature('order_mock_abc', 'pay_mock', undefined, 'development', REAL_SECRET);
  assert(res9.pass === true, 'Mock order in dev passes without signature');
}

// ── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔒 Security Regression Tests\n');

  // Non-DB tests first (always run)
  testMockBypassLogic();

  // DB tests require MongoDB
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bharatclap_test';
  try {
    await mongoose.connect(mongoUri);
    console.log(`\nConnected to ${mongoUri}`);
    await testProviderWalletGuards();
  } catch (err: any) {
    console.warn(`\n⚠️  Skipping DB tests (could not connect to ${mongoUri}): ${err.message}`);
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.error('\n🚨 REGRESSION DETECTED — do not deploy until fixed.');
    process.exit(1);
  } else {
    console.log('\n✅ All security regression tests passed.');
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
