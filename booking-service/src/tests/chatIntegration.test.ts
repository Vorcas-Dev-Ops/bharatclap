import assert from 'assert';
import mongoose from 'mongoose';
import { Conversation } from '../models/Conversation';
import { ChatMessage } from '../models/ChatMessage';

async function runChatIntegrationTest() {
  console.log('🧪 Starting Chat & Moderation Integration Self-Check...');
  const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bharatclap_booking';

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const conversationId = `CHAT-TEST-${Date.now()}`;

    // 1. Test Conversation Creation
    const conversation = await Conversation.create({
      conversation_id: conversationId,
      booking_id: 'BKG-TEST-9999',
      service_title: 'AC Deep Cleaning Integration Test',
      type: 'booking',
      customer: {
        id: 'cust_test_101',
        name: 'Test Customer',
        phone: '+91 98765 43210',
      },
      provider: {
        id: 'prov_test_202',
        name: 'Test Provider',
        phone: '+91 91234 56789',
        serviceCategory: 'AC Cleaning',
      },
      status: 'active',
      last_message: 'Test initial message',
      last_message_at: new Date(),
    });

    assert.ok(conversation._id, 'Conversation should have an ObjectId');
    assert.strictEqual(conversation.conversation_id, conversationId);
    console.log('✅ 1. Conversation creation verified');

    // 2. Test Message Persistence & Content Moderation Flagging
    const phoneMessageText = 'Please call me directly at 9876543210 to pay via GPay';
    const message = await ChatMessage.create({
      conversation_id: conversationId,
      sender_id: 'cust_test_101',
      sender_name: 'Test Customer',
      sender_role: 'customer',
      text: phoneMessageText,
      moderation_flag: {
        reason: 'Phone Number Sharing Restriction, External Payment Attempt (gpay)',
        riskScore: 85,
      },
      status: 'delivered',
    });

    assert.ok(message._id, 'ChatMessage should have an ObjectId');
    assert.strictEqual(message.moderation_flag?.riskScore, 85);
    console.log('✅ 2. Message persistence & moderation flag verified');

    // 3. Test Moderation State Update & Notes Persistence
    conversation.status = 'flagged';
    conversation.moderation.isFlagged = true;
    conversation.moderation.riskScore = 85;
    conversation.moderation.notes.push(`${new Date().toISOString()} - Admin: Flagged off-platform payment attempt`);
    await conversation.save();

    const updatedConv = await Conversation.findOne({ conversation_id: conversationId }).lean();
    assert.strictEqual(updatedConv?.status, 'flagged');
    assert.strictEqual(updatedConv?.moderation.isFlagged, true);
    assert.strictEqual(updatedConv?.moderation.notes.length, 1);
    console.log('✅ 3. Moderation flagging & audit note persistence verified');

    // 4. Test Message Retrieval & Pagination Query
    const messages = await ChatMessage.find({ conversation_id: conversationId }).sort({ createdAt: 1 }).lean();
    assert.strictEqual(messages.length, 1);
    assert.strictEqual(messages[0].text, phoneMessageText);
    console.log('✅ 4. Message retrieval query verified');

    // Cleanup test data
    await Conversation.deleteOne({ conversation_id: conversationId });
    await ChatMessage.deleteMany({ conversation_id: conversationId });
    console.log('🧹 Cleaned up test database records');

    console.log('🎉 ALL CHAT INTEGRATION TESTS PASSED CLEANLY!');
  } catch (err: any) {
    console.error('❌ Chat Integration Test Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

runChatIntegrationTest();
