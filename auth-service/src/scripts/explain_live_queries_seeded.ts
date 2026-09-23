import mongoose, { Types } from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (err) {}

import { Otp } from '../models/Otp';

async function runSeededExplain() {
  console.log('================================================================');
  console.log('LIVE QUERY EXECUTION STATS WITH SEEDED DATA (500 DOCS PER COLLECTION)');
  console.log('================================================================\n');

  const baseMongoURI = process.env.MONGO_URI || '';
  await mongoose.connect(baseMongoURI, { connectTimeoutMS: 20000 });

  // 1. SEED & EXPLAIN OTP COLLECTION
  console.log('--- 1. OTP LOOKUP QUERY EXPLAIN (ON SEEDED COLLECTION) ---');
  const targetPhone = '+919888880001';
  const targetPurpose = 'LOGIN_REGISTRATION';

  // Seed 500 dummy OTP records
  const dummyOtps = [];
  for (let i = 1; i <= 500; i++) {
    dummyOtps.push({
      identifier: `+919800000${String(i).padStart(3, '0')}`,
      purpose: i % 2 === 0 ? 'LOGIN_REGISTRATION' : 'PHONE_CHANGE',
      otpHash: `dummy_hash_${i}`,
      role: 'customer',
      status: 'active',
      attempts: 0,
      createdAt: new Date(Date.now() - i * 1000),
    });
  }
  // Target OTP to find
  dummyOtps.push({
    identifier: targetPhone,
    purpose: targetPurpose,
    otpHash: 'target_hash_real',
    role: 'customer',
    status: 'active',
    attempts: 0,
    createdAt: new Date(),
  });

  await Otp.deleteMany({ identifier: { $regex: '^\\+9198' } });
  await Otp.insertMany(dummyOtps);
  const otpTotalDocs = await Otp.countDocuments();
  console.log(`Total documents in otps collection: ${otpTotalDocs}`);

  const otpExplain = await Otp.collection.find({
    identifier: targetPhone,
    purpose: targetPurpose,
    status: 'active'
  }).explain('executionStats');

  const otpStats = (otpExplain as any).executionStats;
  const otpWinningPlan = (otpExplain as any).queryPlanner?.winningPlan;

  console.log('OTP Winning Plan Stage:', otpWinningPlan?.stage || otpWinningPlan?.inputStage?.stage);
  console.log('Index Used:', otpWinningPlan?.inputStage?.indexName || otpWinningPlan?.indexName);
  console.log('Total Docs in Collection:', otpTotalDocs);
  console.log('nReturned:', otpStats?.nReturned);
  console.log('totalKeysExamined:', otpStats?.totalKeysExamined);
  console.log('totalDocsExamined:', otpStats?.totalDocsExamined);
  console.log('Execution Time (ms):', otpStats?.executionTimeMillis);
  console.log('Raw Plan JSON:\n', JSON.stringify({
    stage: otpWinningPlan?.stage,
    inputStage: otpWinningPlan?.inputStage,
    executionStats: {
      nReturned: otpStats?.nReturned,
      totalKeysExamined: otpStats?.totalKeysExamined,
      totalDocsExamined: otpStats?.totalDocsExamined,
      executionTimeMillis: otpStats?.executionTimeMillis,
    }
  }, null, 2));

  // 2. SEED & EXPLAIN BOOKING COLLECTION
  console.log('\n--- 2. BOOKING QUERY EXPLAIN (ON SEEDED COLLECTION) ---');
  const bookingURI = baseMongoURI.replace('/auth_db', '/booking_db');
  const bookingConn = await mongoose.createConnection(bookingURI).asPromise();
  const bookingCollection = bookingConn.collection('bookings');

  const targetUserId = new Types.ObjectId();
  const dummyBookings = [];
  for (let i = 1; i <= 500; i++) {
    dummyBookings.push({
      booking_id: `BC-TEST-${i}`,
      user_id: i === 250 ? targetUserId : new Types.ObjectId(),
      status: i === 250 ? 'confirmed' : (i % 2 === 0 ? 'completed' : 'pending'),
      payment_status: 'paid',
      createdAt: new Date(Date.now() - i * 60000),
    });
  }

  await bookingCollection.deleteMany({ booking_id: { $regex: '^BC-TEST-' } });
  await bookingCollection.insertMany(dummyBookings);
  const bookingTotalDocs = await bookingCollection.countDocuments();
  console.log(`Total documents in bookings collection: ${bookingTotalDocs}`);

  const bookingExplain = await bookingCollection.find({
    user_id: targetUserId,
    status: 'confirmed'
  }).sort({ createdAt: -1 }).explain('executionStats');

  const bStats = (bookingExplain as any).executionStats;
  const bWinningPlan = (bookingExplain as any).queryPlanner?.winningPlan;

  console.log('Booking Winning Plan Stage:', bWinningPlan?.stage || bWinningPlan?.inputStage?.stage);
  console.log('Index Used:', bWinningPlan?.inputStage?.indexName || bWinningPlan?.indexName);
  console.log('Total Docs in Collection:', bookingTotalDocs);
  console.log('nReturned:', bStats?.nReturned);
  console.log('totalKeysExamined:', bStats?.totalKeysExamined);
  console.log('totalDocsExamined:', bStats?.totalDocsExamined);
  console.log('Execution Time (ms):', bStats?.executionTimeMillis);
  console.log('Raw Plan JSON:\n', JSON.stringify({
    stage: bWinningPlan?.stage,
    inputStage: bWinningPlan?.inputStage,
    executionStats: {
      nReturned: bStats?.nReturned,
      totalKeysExamined: bStats?.totalKeysExamined,
      totalDocsExamined: bStats?.totalDocsExamined,
      executionTimeMillis: bStats?.executionTimeMillis,
    }
  }, null, 2));

  // 3. SEED & EXPLAIN PAYMENT COLLECTION
  console.log('\n--- 3. PAYMENT QUERY EXPLAIN (ON SEEDED COLLECTION) ---');
  const paymentURI = baseMongoURI.replace('/auth_db', '/payment_db');
  const paymentConn = await mongoose.createConnection(paymentURI).asPromise();
  const paymentCollection = paymentConn.collection('payments');

  const targetPayId = 'pay_live_test_target_999';
  const dummyPayments = [];
  for (let i = 1; i <= 500; i++) {
    dummyPayments.push({
      razorpay_payment_id: i === 300 ? targetPayId : `pay_dummy_seed_${i}`,
      razorpay_order_id: `order_dummy_seed_${i}`,
      amount: 1000 + i,
      payment_status: 'completed',
      createdAt: new Date(Date.now() - i * 60000),
    });
  }

  await paymentCollection.deleteMany({ razorpay_payment_id: { $regex: '^pay_dummy_seed_|^pay_live_test_target_' } });
  await paymentCollection.insertMany(dummyPayments);
  const paymentTotalDocs = await paymentCollection.countDocuments();
  console.log(`Total documents in payments collection: ${paymentTotalDocs}`);

  const paymentExplain = await paymentCollection.find({
    razorpay_payment_id: targetPayId
  }).explain('executionStats');

  const pStats = (paymentExplain as any).executionStats;
  const pWinningPlan = (paymentExplain as any).queryPlanner?.winningPlan;

  console.log('Payment Winning Plan Stage:', pWinningPlan?.stage || pWinningPlan?.inputStage?.stage);
  console.log('Index Used:', pWinningPlan?.inputStage?.indexName || pWinningPlan?.indexName);
  console.log('Total Docs in Collection:', paymentTotalDocs);
  console.log('nReturned:', pStats?.nReturned);
  console.log('totalKeysExamined:', pStats?.totalKeysExamined);
  console.log('totalDocsExamined:', pStats?.totalDocsExamined);
  console.log('Execution Time (ms):', pStats?.executionTimeMillis);
  console.log('Raw Plan JSON:\n', JSON.stringify({
    stage: pWinningPlan?.stage,
    inputStage: pWinningPlan?.inputStage,
    executionStats: {
      nReturned: pStats?.nReturned,
      totalKeysExamined: pStats?.totalKeysExamined,
      totalDocsExamined: pStats?.totalDocsExamined,
      executionTimeMillis: pStats?.executionTimeMillis,
    }
  }, null, 2));

  // CLEANUP SEEDED DATA
  await Otp.deleteMany({ identifier: { $regex: '^\\+9198' } });
  await bookingCollection.deleteMany({ booking_id: { $regex: '^BC-TEST-' } });
  await paymentCollection.deleteMany({ razorpay_payment_id: { $regex: '^pay_dummy_seed_|^pay_live_test_target_' } });

  await bookingConn.close();
  await paymentConn.close();
  await mongoose.disconnect();
  console.log('\n✔ SEEDED EXPLAIN RUN COMPLETE & CLEANED UP');
}

runSeededExplain().catch(err => {
  console.error('SEEDED EXPLAIN FAILURE:', err);
  process.exit(1);
});
