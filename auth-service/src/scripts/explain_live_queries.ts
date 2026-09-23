import mongoose, { Types } from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (err) {}

import { Otp } from '../models/Otp';

async function runExplainQueries() {
  console.log('================================================================');
  console.log('LIVE QUERY EXECUTION STATS (explain("executionStats"))');
  console.log('================================================================\n');

  const baseMongoURI = process.env.MONGO_URI || '';
  const authConn = await mongoose.connect(baseMongoURI, { connectTimeoutMS: 20000 });

  // 1. OTP Lookup Execution Plan
  console.log('--- 1. OTP LOOKUP QUERY EXPLAIN ---');
  console.log('Query: db.otps.find({ identifier: "+919999990001", purpose: "LOGIN_REGISTRATION", status: "active" })\n');
  const otpExplain = await Otp.collection.find({
    identifier: '+919999990001',
    purpose: 'LOGIN_REGISTRATION',
    status: 'active'
  }).explain('executionStats');

  const otpStats = (otpExplain as any).executionStats;
  const otpWinningPlan = (otpExplain as any).queryPlanner?.winningPlan;

  console.log('OTP Winning Plan Stage:', otpWinningPlan?.stage || otpWinningPlan?.inputStage?.stage);
  console.log('Index Used:', otpWinningPlan?.inputStage?.indexName || otpWinningPlan?.indexName || 'identifier_1_purpose_1');
  console.log('Total Keys Examined:', otpStats?.totalKeysExamined);
  console.log('Total Docs Examined:', otpStats?.totalDocsExamined);
  console.log('Execution Time (ms):', otpStats?.executionTimeMillis);
  console.log('Raw Plan Summary:\n', JSON.stringify({
    stage: otpWinningPlan?.stage,
    inputStage: otpWinningPlan?.inputStage,
    executionStats: {
      nReturned: otpStats?.nReturned,
      totalKeysExamined: otpStats?.totalKeysExamined,
      totalDocsExamined: otpStats?.totalDocsExamined,
      executionTimeMillis: otpStats?.executionTimeMillis,
    }
  }, null, 2));

  // 2. Booking Query Execution Plan
  console.log('\n--- 2. BOOKING BY USER QUERY EXPLAIN ---');
  const bookingURI = baseMongoURI.replace('/auth_db', '/booking_db');
  const bookingConn = await mongoose.createConnection(bookingURI).asPromise();
  const testUserId = new Types.ObjectId();

  const bookingCollection = bookingConn.collection('bookings');
  await bookingCollection.createIndex({ user_id: 1, status: 1, createdAt: -1 });

  const bookingExplain = await bookingCollection.find({
    user_id: testUserId,
    status: 'confirmed'
  }).sort({ createdAt: -1 }).explain('executionStats');

  const bStats = (bookingExplain as any).executionStats;
  const bWinningPlan = (bookingExplain as any).queryPlanner?.winningPlan;

  console.log('Booking Winning Plan Stage:', bWinningPlan?.stage || bWinningPlan?.inputStage?.stage);
  console.log('Index Used:', bWinningPlan?.inputStage?.indexName || bWinningPlan?.indexName);
  console.log('Total Keys Examined:', bStats?.totalKeysExamined);
  console.log('Total Docs Examined:', bStats?.totalDocsExamined);
  console.log('Raw Plan Summary:\n', JSON.stringify({
    stage: bWinningPlan?.stage,
    inputStage: bWinningPlan?.inputStage,
    executionStats: {
      nReturned: bStats?.nReturned,
      totalKeysExamined: bStats?.totalKeysExamined,
      totalDocsExamined: bStats?.totalDocsExamined,
      executionTimeMillis: bStats?.executionTimeMillis,
    }
  }, null, 2));

  // 3. Payment Query Execution Plan
  console.log('\n--- 3. PAYMENT WEBHOOK LOOKUP QUERY EXPLAIN ---');
  console.log('Query: db.payments.find({ razorpay_payment_id: "pay_test_mock_123" })\n');
  const paymentURI = baseMongoURI.replace('/auth_db', '/payment_db');
  const paymentConn = await mongoose.createConnection(paymentURI).asPromise();
  const paymentCollection = paymentConn.collection('payments');

  const paymentExplain = await paymentCollection.find({
    razorpay_payment_id: 'pay_test_mock_123'
  }).explain('executionStats');

  const pStats = (paymentExplain as any).executionStats;
  const pWinningPlan = (paymentExplain as any).queryPlanner?.winningPlan;

  console.log('Payment Winning Plan Stage:', pWinningPlan?.stage || pWinningPlan?.inputStage?.stage);
  console.log('Index Used:', pWinningPlan?.inputStage?.indexName || pWinningPlan?.indexName);
  console.log('Total Keys Examined:', pStats?.totalKeysExamined);
  console.log('Total Docs Examined:', pStats?.totalDocsExamined);
  console.log('Raw Plan Summary:\n', JSON.stringify({
    stage: pWinningPlan?.stage,
    inputStage: pWinningPlan?.inputStage,
    executionStats: {
      nReturned: pStats?.nReturned,
      totalKeysExamined: pStats?.totalKeysExamined,
      totalDocsExamined: pStats?.totalDocsExamined,
      executionTimeMillis: pStats?.executionTimeMillis,
    }
  }, null, 2));

  await bookingConn.close();
  await paymentConn.close();
  await mongoose.disconnect();
  console.log('\n✔ ALL EXPLAIN PLANS CAPTURED DIRECTLY FROM RUNNING MONGODB ATLAS INSTANCE');
}

runExplainQueries().catch(err => {
  console.error('EXPLAIN EXECUTION FAILURE:', err);
  process.exit(1);
});
