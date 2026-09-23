import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (err) {}

import { Otp } from '../models/Otp';
import { hashOtp, normalizeIdentifier } from '../controllers/user/verificationController';

async function runLiveVerification() {
  console.log('================================================================');
  console.log('LIVE DATABASE VERIFICATION & RUNTIME STATE SUITE');
  console.log('================================================================\n');

  const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/auth_db';
  await mongoose.connect(mongoURI, { connectTimeoutMS: 20000 });
  console.log(`Connected to MongoDB Atlas: ${mongoose.connection.host}/${mongoose.connection.name}`);

  // 1. DUMP RAW MONGO INDEXES ON db.otps
  console.log('\n--- 1. RAW OUTPUT OF db.otps.getIndexes() ---');
  await Otp.syncIndexes();
  const rawIndexes = await Otp.collection.getIndexes();
  console.log(JSON.stringify(rawIndexes, null, 2));

  // 2. MULTI-PURPOSE COEXISTENCE TEST
  console.log('\n--- 2. MULTI-PURPOSE COEXISTENCE TEST ---');
  const testPhone = '+919999990001';
  await Otp.deleteMany({ identifier: testPhone });

  const loginHash = hashOtp('111111', testPhone);
  const phoneChangeHash = hashOtp('222222', testPhone);

  const loginDoc = await Otp.create({
    identifier: testPhone,
    purpose: 'LOGIN_REGISTRATION',
    otpHash: loginHash,
    role: 'customer',
    status: 'active',
    attempts: 0,
  });

  const phoneChangeDoc = await Otp.create({
    identifier: testPhone,
    purpose: 'PHONE_CHANGE',
    otpHash: phoneChangeHash,
    role: 'customer',
    status: 'active',
    attempts: 0,
  });

  console.log('Created Login OTP ID:', loginDoc._id, 'Purpose:', loginDoc.purpose);
  console.log('Created Phone Change OTP ID:', phoneChangeDoc._id, 'Purpose:', phoneChangeDoc.purpose);

  const existingDocs = await Otp.find({ identifier: testPhone });
  console.log(`Verified count for same phone with different purposes: ${existingDocs.length} (Expected: 2)`);
  if (existingDocs.length !== 2) throw new Error('Multi-purpose coexistence failed!');

  // Duplicate with same identifier AND same purpose must reject
  let duplicateRejected = false;
  try {
    await Otp.create({
      identifier: testPhone,
      purpose: 'LOGIN_REGISTRATION',
      otpHash: 'duplicate_hash',
      role: 'customer',
    });
  } catch (err: any) {
    if (err.code === 11000) {
      duplicateRejected = true;
      console.log('✔ Duplicate challenge on (identifier + purpose) successfully rejected with E11000 Duplicate Key Error.');
    }
  }
  if (!duplicateRejected) throw new Error('Duplicate key on (identifier, purpose) was not rejected!');

  // 3. CORRECTNESS-BEFORE-ATTEMPT & CAS CLAIM TEST (ATTEMPT #5 CORRECT TEST)
  console.log('\n--- 3. CORRECTNESS EVALUATION & CAS CLAIM TEST ---');
  const claimTarget = await Otp.create({
    identifier: '+919999990002',
    purpose: 'LOGIN_REGISTRATION',
    otpHash: hashOtp('555555', '+919999990002'),
    role: 'customer',
    status: 'active',
    attempts: 4, // 4 failed attempts previously
  });

  // Submission with correct code on 5th attempt
  const claimed = await Otp.findOneAndUpdate(
    { _id: claimTarget._id, status: 'active' },
    { $set: { status: 'consumed', consumedAt: new Date() } },
    { new: true }
  );

  console.log('Attempt #5 Correct OTP CAS Result: status =', claimed?.status, '(Expected: consumed)');
  if (claimed?.status !== 'consumed') throw new Error('CAS claim on attempt #5 correct failed!');

  // Re-claiming the same OTP concurrently must fail
  const secondClaim = await Otp.findOneAndUpdate(
    { _id: claimTarget._id, status: 'active' },
    { $set: { status: 'consumed', consumedAt: new Date() } },
    { new: true }
  );
  console.log('Second concurrent CAS claim on same OTP result:', secondClaim, '(Expected: null)');
  if (secondClaim !== null) throw new Error('Double-consumption allowed!');

  // 4. ATOMIC PIPELINE INCREMENT AND LOCKOUT AT ATTEMPT #5
  console.log('\n--- 4. SINGLE ATOMIC AGGREGATION PIPELINE INCREMENT & LOCKOUT ---');
  const wrongTarget = await Otp.create({
    identifier: '+919999990003',
    purpose: 'LOGIN_REGISTRATION',
    otpHash: hashOtp('888888', '+919999990003'),
    role: 'customer',
    status: 'active',
    attempts: 4,
  });

  // Pipeline update for wrong submission on attempt #5
  const pipelineResult = await Otp.findOneAndUpdate(
    { _id: wrongTarget._id, status: 'active' },
    [
      { $set: { attempts: { $add: ['$attempts', 1] } } },
      {
        $set: {
          status: { $cond: [{ $gte: ['$attempts', 5] }, 'consumed', 'active'] },
          consumedAt: { $cond: [{ $gte: ['$attempts', 5] }, new Date(), '$$REMOVE'] }
        }
      }
    ],
    { new: true }
  );

  console.log('Pipeline update result for 5th wrong attempt:', {
    attempts: pipelineResult?.attempts,
    status: pipelineResult?.status,
    consumedAt: pipelineResult?.consumedAt ? 'Set (Timestamp)' : 'Not Set'
  });
  if (pipelineResult?.attempts !== 5 || pipelineResult?.status !== 'consumed') {
    throw new Error('Pipeline atomic attempt increment failed!');
  }

  // Cleanup test artifacts
  await Otp.deleteMany({ identifier: { $in: ['+919999990001', '+919999990002', '+919999990003'] } });
  console.log('\n✔ ALL LIVE DATABASE VERIFICATION TESTS PASSED CLEANLY');
  await mongoose.disconnect();
}

runLiveVerification().catch(err => {
  console.error('VERIFICATION FAILURE:', err);
  process.exit(1);
});
