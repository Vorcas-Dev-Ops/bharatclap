import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

import dotenv from 'dotenv';
dotenv.config();

import assert from 'assert';
import mongoose from 'mongoose';
import { Conversation } from '../models/Conversation';
import { ChatMessage } from '../models/ChatMessage';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/booking_db';

async function runOperationalHardeningCheck() {
  console.log('⚡ Running Final Operational Hardening & Fault Tolerance Verification...\n');
  let failures = 0;

  try {
    await mongoose.connect(MONGO_URI, { connectTimeoutMS: 10000, socketTimeoutMS: 15000 });
    console.log('✅ 1. MongoDB Connection established');

    // ───────────────────────────────────────────────────────────────────────────
    // CHECK 1: MongoDB Index Registration Verification
    // ───────────────────────────────────────────────────────────────────────────
    console.log('\n🔹 CHECK 1: MongoDB Index Registration Verification');
    await Conversation.syncIndexes();
    await ChatMessage.syncIndexes();

    const convIndexes = await Conversation.collection.indexes();
    const msgIndexes = await ChatMessage.collection.indexes();

    const convIndexKeys = convIndexes.map((idx) => Object.keys(idx.key).join('_'));
    const msgIndexKeys = msgIndexes.map((idx) => Object.keys(idx.key).join('_'));

    assert.ok(convIndexKeys.includes('conversation_id'), 'Conversation must have conversation_id index');
    assert.ok(msgIndexKeys.includes('conversation_id'), 'ChatMessage must have conversation_id index');
    assert.ok(msgIndexKeys.includes('conversation_id_createdAt'), 'ChatMessage must have compound conversation_id_createdAt index');
    console.log('  ✓ Conversation indexes verified:', convIndexKeys);
    console.log('  ✓ ChatMessage indexes verified:', msgIndexKeys);

    // ───────────────────────────────────────────────────────────────────────────
    // CHECK 2: Pagination & Message Ordering Verification
    // ───────────────────────────────────────────────────────────────────────────
    console.log('\n🔹 CHECK 2: Message Ordering & Pagination Limits');
    const pageTestId = `CHAT-PAGE-${Date.now()}`;

    await Conversation.create({
      conversation_id: pageTestId,
      booking_id: 'BKG-PAGE-100',
      type: 'booking',
      customer: { id: 'cust_p1', name: 'Paging Customer', phone: '+91 99999 88888' },
      status: 'active',
      last_message: 'Page test',
      last_message_at: new Date(),
    });

    const msgsToInsert = [];
    for (let i = 1; i <= 15; i++) {
      msgsToInsert.push({
        conversation_id: pageTestId,
        sender_id: 'cust_p1',
        sender_name: 'Paging Customer',
        sender_role: 'customer' as const,
        text: `Test message ${i}`,
        status: 'delivered' as const,
        createdAt: new Date(Date.now() + i * 100),
      });
    }
    await ChatMessage.insertMany(msgsToInsert);

    // Test ordered fetch (ascending by createdAt)
    const fetchedMsgs = await ChatMessage.find({ conversation_id: pageTestId })
      .sort({ createdAt: 1 })
      .limit(10)
      .lean();

    assert.strictEqual(fetchedMsgs.length, 10);
    assert.strictEqual(fetchedMsgs[0].text, 'Test message 1');
    assert.strictEqual(fetchedMsgs[9].text, 'Test message 10');
    console.log('  ✓ Message ordering (ascending by createdAt) and page limit (10) verified');

    // Cleanup
    await Conversation.deleteOne({ conversation_id: pageTestId });
    await ChatMessage.deleteMany({ conversation_id: pageTestId });
    console.log('  ✓ Cleaned up pagination test records');

    console.log('\n✅ ALL OPERATIONAL HARDENING CHECKS PASSED SUCCESSFULLY!\n');
  } catch (err: any) {
    console.error('❌ FAIL:', err.message);
    failures++;
  } finally {
    await mongoose.disconnect();
  }

  if (failures === 0) {
    console.log('🎉 FINAL PRODUCTION VERIFICATION COMPLETE: ALL CHECKS PASSED!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runOperationalHardeningCheck();
