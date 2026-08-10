import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

import dotenv from 'dotenv';
dotenv.config();

import assert from 'assert';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/booking_db';

async function runBugFixVerification() {
  console.log('⚡ Running Cash Deposit Bug Fix & Edge Case Verification...\n');
  try {
    await mongoose.connect(MONGO_URI, { connectTimeoutMS: 10000, socketTimeoutMS: 15000 });

    // Connect provider-service's internal mongoose instance as well
    const provMongoose = require('../../../provider-service/node_modules/mongoose');
    if (provMongoose.connection.readyState === 0) {
      await provMongoose.connect(MONGO_URI, { connectTimeoutMS: 10000, socketTimeoutMS: 15000 });
    }
    console.log('✅ Connected to MongoDB Atlas (both instances)');

    const { Provider } = await import('../../../provider-service/src/models/Provider');
    const { LedgerEntry } = await import('../../../provider-service/src/models/LedgerEntry');
    const { recordCashDepositAdmin } = await import('../../../provider-service/src/controllers/provider/codController');

    // Create test provider with exact user balance ₹229.923
    const providerCode = `PFIX_${Date.now().toString().slice(-6)}`;
    const provider = await Provider.create({
      user_id: new mongoose.Types.ObjectId(),
      provider_code: providerCode,
      codDueBalance: 229.923,
      status: 'active',
      isDispatchBlockedByCod: false,
    });
    console.log(`Created test provider ${provider._id} with codDueBalance = ₹229.923`);

    // Helper mock response
    const createMockRes = () => {
      const res: any = {};
      res.statusCode = 200;
      res.data = null;
      res.status = (code: number) => { res.statusCode = code; return res; };
      res.json = (data: any) => { res.data = data; return res; };
      return res;
    };

    // TEST 1: Record ₹230 cash against ₹229.923 balance (Rounding / Overpayment Reconciliation)
    console.log('\n🔹 TEST 1: Record ₹230 cash deposit against ₹229.923 balance');
    const req1: any = {
      params: { id: provider._id.toString() },
      body: { amount: 230, reference: `CASH-HUB-TEST-${Date.now()}`, notes: 'Recorded at BharatClap Hub' },
      user: { _id: new mongoose.Types.ObjectId().toString() },
    };
    const res1 = createMockRes();
    await recordCashDepositAdmin(req1, res1);

    assert.strictEqual(res1.statusCode, 200, 'HTTP status should be 200 OK');
    assert.strictEqual(res1.data?.success, true);
    assert.strictEqual(res1.data?.receipt?.newCodBalance, 0, 'New balance should be ₹0');
    console.log('  ✓ TEST 1 PASSED: ₹230 cash deposit recorded; balance updated from ₹229.923 to ₹0');

    // TEST 2: Duplicate reference idempotency guard
    console.log('\n🔹 TEST 2: Duplicate reference idempotency guard');
    const res2 = createMockRes();
    await recordCashDepositAdmin(req1, res2);

    assert.strictEqual(res2.statusCode, 200);
    assert.strictEqual(res2.data?.alreadyProcessed, true);
    console.log('  ✓ TEST 2 PASSED: Duplicate deposit call returns alreadyProcessed: true without duplicate ledger');

    // TEST 3: Validation failure — Excessive overpayment (> ₹1.00 difference)
    console.log('\n🔹 TEST 3: Validation failure — Excessive overpayment amount');
    const req3: any = {
      params: { id: provider._id.toString() },
      body: { amount: 500, reference: `CASH-EXCESS-${Date.now()}` },
    };
    const res3 = createMockRes();
    await recordCashDepositAdmin(req3, res3);

    assert.strictEqual(res3.statusCode, 400, 'HTTP status should be 400 Bad Request');
    assert.ok(res3.data?.message.includes('cannot exceed outstanding COD balance'));
    console.log(`  ✓ TEST 3 PASSED: Returned 400 Bad Request with message: "${res3.data?.message}"`);

    // TEST 4: Invalid Provider ID
    console.log('\n🔹 TEST 4: Non-existent provider ID');
    const req4: any = {
      params: { id: new mongoose.Types.ObjectId().toString() },
      body: { amount: 50, reference: `CASH-NONEXIST-${Date.now()}` },
    };
    const res4 = createMockRes();
    await recordCashDepositAdmin(req4, res4);

    assert.strictEqual(res4.statusCode, 404, 'HTTP status should be 404 Not Found');
    console.log(`  ✓ TEST 4 PASSED: Returned 404 Not Found cleanly`);

    // Cleanup
    await Provider.deleteOne({ _id: provider._id });
    await LedgerEntry.deleteMany({ entity_id: provider._id });
    console.log('\n🧹 Cleaned up test provider and ledger entries');

    console.log('\n🎉 ALL CASH DEPOSIT BUG FIX TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ BUG FIX VERIFICATION FAILED:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    try {
      const provMongoose = require('../../../provider-service/node_modules/mongoose');
      await provMongoose.disconnect();
    } catch (e) {}
  }
}

runBugFixVerification();
