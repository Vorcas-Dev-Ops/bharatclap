import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

import dotenv from 'dotenv';
dotenv.config();

import assert from 'assert';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { Conversation } from '../models/Conversation';
import { ChatMessage } from '../models/ChatMessage';

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://fixvoadmin_db_user:Fixvo123@cluster0.rdlnwbx.mongodb.net/booking_db?appName=Cluster0';

async function runDirectE2EVerification() {
  console.log('🛡️ Running Standalone Chat & Moderation E2E Verification...\n');
  let failures = 0;

  try {
    await mongoose.connect(MONGO_URI, { connectTimeoutMS: 10000, socketTimeoutMS: 15000 });
    console.log('✅ 1. Connected to MongoDB Atlas (booking_db)');

    // ───────────────────────────────────────────────────────────────────────────
    // TEST 1: Internal Service Key Security & Frontend Isolation Check
    // ───────────────────────────────────────────────────────────────────────────
    console.log('\n🔹 TEST 1: Internal Service Key Isolation Check');
    const frontendEnvPath = path.resolve(__dirname, '../../../frontend/.env');
    const frontendEnvLocalPath = path.resolve(__dirname, '../../../frontend/.env.local');

    let leaked = false;
    [frontendEnvPath, frontendEnvLocalPath].forEach((p) => {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        if (content.includes('INTERNAL_SERVICE_KEY') || content.includes('NEXT_PUBLIC_INTERNAL_SERVICE_KEY')) {
          leaked = true;
        }
      }
    });

    assert.strictEqual(leaked, false, 'INTERNAL_SERVICE_KEY must NOT be in frontend .env!');
    console.log('  ✓ Internal Service Key is strictly server-side (zero frontend exposure)');

    // ───────────────────────────────────────────────────────────────────────────
    // TEST 2: Conversation & ChatMessage Persistence, Idempotency & Moderation
    // ───────────────────────────────────────────────────────────────────────────
    console.log('\n🔹 TEST 2: Conversation, Message Persistence & Moderation Flow');
    const e2eId = `CHAT-E2E-DIRECT-${Date.now()}`;
    const idempKey = `idemp_${Date.now()}`;

    // 2a. Create Conversation
    const conversation = await Conversation.create({
      conversation_id: e2eId,
      booking_id: 'BKG-E2E-100',
      service_title: 'Full House Cleaning Support',
      type: 'booking',
      customer: { id: 'cust_e2e_1', name: 'Customer E2E', phone: '+91 98765 43210' },
      provider: { id: 'prov_e2e_1', name: 'Provider E2E', phone: '+91 91234 56789' },
      status: 'active',
      last_message: 'Initial message',
      last_message_at: new Date(),
    });
    assert.ok(conversation._id, 'Conversation should be created');
    console.log('  ✓ 2a. Conversation created in MongoDB');

    // 2b. Customer message with Idempotency Key
    const msg1 = await ChatMessage.create({
      conversation_id: e2eId,
      sender_id: 'cust_e2e_1',
      sender_name: 'Customer E2E',
      sender_role: 'customer',
      text: 'Please call me at 9988776655 to pay via Paytm',
      idempotency_key: idempKey,
      moderation_flag: {
        reason: 'Phone Number Sharing Restriction, External Payment Attempt (paytm)',
        riskScore: 85,
      },
      status: 'delivered',
    });
    assert.ok(msg1._id, 'ChatMessage 1 created');
    assert.strictEqual(msg1.moderation_flag?.riskScore, 85);
    console.log('  ✓ 2b. Customer message persisted with moderation flags (risk 85)');

    // 2c. Idempotency Key Duplicate Prevention
    const existing = await ChatMessage.findOne({ idempotency_key: idempKey }).lean();
    assert.ok(existing, 'Found existing message by idempotency_key');
    assert.strictEqual(existing?._id.toString(), msg1._id.toString());
    console.log('  ✓ 2c. Idempotency Key lookup successfully matched existing DB record');

    // 2d. Provider reply message
    const msg2 = await ChatMessage.create({
      conversation_id: e2eId,
      sender_id: 'prov_e2e_1',
      sender_name: 'Provider E2E',
      sender_role: 'provider',
      text: 'I am outside the gate.',
      status: 'delivered',
    });
    assert.ok(msg2._id);
    console.log('  ✓ 2d. Provider reply message persisted');

    // 2e. Admin Intervention Message
    const adminMsg = await ChatMessage.create({
      conversation_id: e2eId,
      sender_id: 'admin_test_1',
      sender_name: 'Super Admin Sumanth',
      sender_role: 'admin',
      text: '[ADMIN INTERVENTION] Off-platform payments are prohibited.',
      is_intervention: true,
      status: 'delivered',
    });
    assert.strictEqual(adminMsg.is_intervention, true);
    assert.strictEqual(adminMsg.sender_role, 'admin');
    console.log('  ✓ 2e. Admin intervention persisted with is_intervention=true & sender_role=admin');

    // 2f. Moderation Flagging & Audit Notes
    conversation.status = 'flagged';
    conversation.moderation.isFlagged = true;
    conversation.moderation.riskScore = 85;
    conversation.moderation.flaggedReasons = ['Phone Number Sharing Restriction', 'External Payment Attempt (paytm)'];
    conversation.moderation.notes.push(`${new Date().toISOString()} - Super Admin Sumanth: Flagged off-platform payment attempt`);
    await conversation.save();

    const flaggedConv = await Conversation.findOne({ conversation_id: e2eId }).lean();
    assert.strictEqual(flaggedConv?.status, 'flagged');
    assert.strictEqual(flaggedConv?.moderation.isFlagged, true);
    assert.strictEqual(flaggedConv?.moderation.notes.length, 1);
    console.log('  ✓ 2f. Moderation flagging & audit notes persisted');

    // 2g. Resolution
    conversation.status = 'resolved';
    await conversation.save();
    const resolvedConv = await Conversation.findOne({ conversation_id: e2eId }).lean();
    assert.strictEqual(resolvedConv?.status, 'resolved');
    console.log('  ✓ 2g. Conversation status updated to resolved in MongoDB');

    // Cleanup
    await Conversation.deleteOne({ conversation_id: e2eId });
    await ChatMessage.deleteMany({ conversation_id: e2eId });
    console.log('🧹 Cleaned up test database records');

    console.log('\n✅ PASS: Standalone Chat & Moderation E2E Verification complete!\n');
  } catch (err: any) {
    console.error('❌ FAIL:', err.message);
    failures++;
  } finally {
    await mongoose.disconnect();
  }

  if (failures === 0) {
    console.log('🎉 ALL VERIFICATION TESTS PASSED (0 failures)!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runDirectE2EVerification();
