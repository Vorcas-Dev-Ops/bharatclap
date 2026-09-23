import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface ChatMessageEntity {
  id: string;
  _id: string;
  conversation_id: string;
  conversationId: string;
  sender_id: string;
  senderId: string;
  sender_name?: string;
  senderName?: string;
  sender_role?: string;
  senderRole?: string;
  message: string;
  text: string;
  message_type: 'text' | 'image' | 'system' | 'audio';
  messageType: 'text' | 'image' | 'system' | 'audio';
  status: string;
  is_intervention?: boolean;
  moderation_flag?: any;
  created_at: Date;
  createdAt: Date;
}

export interface ConversationEntity {
  id: string;
  _id: string;
  conversation_id: string;
  conversationId: string;
  booking_id?: string;
  bookingId?: string;
  status: 'active' | 'closed' | 'archived' | 'flagged' | 'resolved';
  customer?: { id: string; name: string; phone?: string };
  provider?: { id: string; name: string; phone?: string };
  last_message?: string;
  last_message_at?: Date;
  unread_count_customer: number;
  unread_count_provider: number;
  unread_count_admin: number;
  moderation: {
    isFlagged: boolean;
    riskScore: number;
    flaggedReasons: string[];
    notes: string[];
    reviewedBy?: string;
    reviewedAt?: Date;
  };
  created_at: Date;
  updated_at: Date;
}

export const mapChatMessageRow = (row: any): ChatMessageEntity => {
  if (!row) return null as any;
  const idStr = String(row.id);
  const convIdStr = String(row.conversation_id);
  const senderIdStr = String(row.sender_id);
  const msgText = row.message || '';

  return {
    id: idStr,
    _id: idStr,
    conversation_id: convIdStr,
    conversationId: convIdStr,
    sender_id: senderIdStr,
    senderId: senderIdStr,
    sender_name: row.sender_name || 'User',
    senderName: row.sender_name || 'User',
    sender_role: row.sender_role || 'customer',
    senderRole: row.sender_role || 'customer',
    message: msgText,
    text: msgText,
    message_type: row.message_type || 'text',
    messageType: row.message_type || 'text',
    status: row.status || 'delivered',
    is_intervention: Boolean(row.is_intervention),
    moderation_flag: row.moderation_flag ? (typeof row.moderation_flag === 'string' ? JSON.parse(row.moderation_flag) : row.moderation_flag) : undefined,
    created_at: new Date(row.created_at || Date.now()),
    createdAt: new Date(row.created_at || Date.now()),
  };
};

export class ChatRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findConversationByIdOrBooking(identifier: string): Promise<ConversationEntity | null> {
    const res = await this.pool.query(
      `SELECT c.*,
              b.booking_id AS display_booking_id,
              cu.id AS cust_id, cu.name AS cust_name, cu.phone AS cust_phone,
              pr.id AS prov_id, pr.name AS prov_name, pr.phone AS prov_phone,
              (SELECT message FROM booking.chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS latest_message,
              (SELECT created_at FROM booking.chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS latest_message_at
       FROM booking.conversations c
       LEFT JOIN booking.bookings b ON b.id = c.booking_id
       LEFT JOIN auth.users cu ON cu.id = b.user_id
       LEFT JOIN auth.users pr ON pr.id = b.provider_id
       WHERE c.id::text = $1
          OR c.legacy_mongo_id = $1
          OR b.booking_id = $1
          OR b.id::text = $1
       LIMIT 1`,
      [identifier]
    );

    if (!res.rows[0]) return null;
    const r = res.rows[0];
    const cId = String(r.id);

    return {
      id: cId,
      _id: cId,
      conversation_id: cId,
      conversationId: cId,
      booking_id: r.display_booking_id || (r.booking_id ? String(r.booking_id) : undefined),
      bookingId: r.display_booking_id || (r.booking_id ? String(r.booking_id) : undefined),
      status: r.status,
      customer: r.cust_id ? { id: String(r.cust_id), name: r.cust_name || 'Customer', phone: r.cust_phone } : undefined,
      provider: r.prov_id ? { id: String(r.prov_id), name: r.prov_name || 'Provider', phone: r.prov_phone } : undefined,
      last_message: r.latest_message || undefined,
      last_message_at: r.latest_message_at ? new Date(r.latest_message_at) : undefined,
      unread_count_customer: 0,
      unread_count_provider: 0,
      unread_count_admin: 0,
      moderation: {
        isFlagged: r.status === 'flagged',
        riskScore: r.status === 'flagged' ? 85 : 0,
        flaggedReasons: [],
        notes: [],
      },
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at),
    };
  }

  static async findOrCreateConversation(
    bookingId?: string,
    customerId?: string,
    providerId?: string
  ): Promise<ConversationEntity> {
    if (bookingId) {
      const existing = await this.findConversationByIdOrBooking(bookingId);
      if (existing) return existing;
    }

    const insertRes = await this.pool.query(
      `INSERT INTO booking.conversations (
         booking_id, status
       ) VALUES (
         (SELECT id FROM booking.bookings WHERE id::text = $1 OR legacy_mongo_id = $1 OR booking_id = $1 LIMIT 1),
         'active'
       ) RETURNING id`,
      [bookingId || null]
    );
    const convId = String(insertRes.rows[0].id);

    if (customerId) {
      await this.pool.query(
        `INSERT INTO booking.conversation_participants (conversation_id, user_id, participant_type)
         VALUES (
           $1,
           (SELECT id FROM auth.users WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1),
           'customer'
         ) ON CONFLICT DO NOTHING`,
        [convId, customerId]
      );
    }

    if (providerId) {
      await this.pool.query(
        `INSERT INTO booking.conversation_participants (conversation_id, user_id, participant_type)
         VALUES (
           $1,
           (SELECT id FROM auth.users WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1),
           'provider'
         ) ON CONFLICT DO NOTHING`,
        [convId, providerId]
      );
    }

    return (await this.findConversationByIdOrBooking(convId))!;
  }

  static async addMessage(data: {
    conversationId: string;
    senderId: string;
    text: string;
    messageType?: string;
    status?: string;
    isIntervention?: boolean;
    moderationFlag?: any;
    idempotencyKey?: string;
  }): Promise<ChatMessageEntity> {
    // Resolve conversation UUID
    let conv = await this.findConversationByIdOrBooking(data.conversationId);
    if (!conv) {
      conv = await this.findOrCreateConversation(data.conversationId, data.senderId);
    }

    const res = await this.pool.query(
      `INSERT INTO booking.chat_messages (
         conversation_id, sender_id, message, message_type
       ) VALUES (
         $1,
         COALESCE(
           (SELECT id FROM auth.users WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1),
           '00000000-0000-0000-0000-000000000000'::uuid
         ),
         $3,
         $4
       ) RETURNING *`,
      [
        conv.id,
        data.senderId,
        data.text,
        data.messageType || 'text',
      ]
    );

    // Touch conversation updated_at
    await this.pool.query(`UPDATE booking.conversations SET updated_at = NOW() WHERE id = $1`, [conv.id]);

    return mapChatMessageRow(res.rows[0]);
  }

  static async getMessages(conversationId: string, page: number = 1, limit: number = 50): Promise<{ messages: ChatMessageEntity[]; total: number }> {
    const conv = await this.findConversationByIdOrBooking(conversationId);
    if (!conv) return { messages: [], total: 0 };

    const offset = (page - 1) * limit;
    const [msgRes, countRes] = await Promise.all([
      this.pool.query(
        `SELECT m.*, u.name AS sender_name,
                CASE WHEN u.role = 'provider' THEN 'provider' WHEN u.role = 'admin' THEN 'admin' ELSE 'customer' END AS sender_role
         FROM booking.chat_messages m
         LEFT JOIN auth.users u ON u.id = m.sender_id
         WHERE m.conversation_id = $1
         ORDER BY m.created_at ASC
         LIMIT $2 OFFSET $3`,
        [conv.id, limit, offset]
      ),
      this.pool.query(
        `SELECT COUNT(*)::int AS total FROM booking.chat_messages WHERE conversation_id = $1`,
        [conv.id]
      ),
    ]);

    return {
      messages: msgRes.rows.map(mapChatMessageRow),
      total: countRes.rows[0]?.total || 0,
    };
  }

  static async findUserConversations(userId: string, role: string = 'customer'): Promise<ConversationEntity[]> {
    const res = await this.pool.query(
      `SELECT c.*,
              b.booking_id AS display_booking_id,
              cu.id AS cust_id, cu.name AS cust_name, cu.phone AS cust_phone,
              pr.id AS prov_id, pr.name AS prov_name, pr.phone AS prov_phone,
              (SELECT message FROM booking.chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS latest_message,
              (SELECT created_at FROM booking.chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS latest_message_at
       FROM booking.conversations c
       JOIN booking.conversation_participants cp ON cp.conversation_id = c.id
       LEFT JOIN booking.bookings b ON b.id = c.booking_id
       LEFT JOIN auth.users cu ON cu.id = b.user_id
       LEFT JOIN auth.users pr ON pr.id = b.provider_id
       WHERE cp.user_id::text = $1 OR cp.user_id = (SELECT id FROM auth.users WHERE legacy_mongo_id = $1 LIMIT 1)
       ORDER BY c.updated_at DESC`,
      [userId]
    );

    return res.rows.map(r => ({
      id: String(r.id),
      _id: String(r.id),
      conversation_id: String(r.id),
      conversationId: String(r.id),
      booking_id: r.display_booking_id || (r.booking_id ? String(r.booking_id) : undefined),
      bookingId: r.display_booking_id || (r.booking_id ? String(r.booking_id) : undefined),
      status: r.status,
      customer: r.cust_id ? { id: String(r.cust_id), name: r.cust_name || 'Customer', phone: r.cust_phone } : undefined,
      provider: r.prov_id ? { id: String(r.prov_id), name: r.prov_name || 'Provider', phone: r.prov_phone } : undefined,
      last_message: r.latest_message || undefined,
      last_message_at: r.latest_message_at ? new Date(r.latest_message_at) : undefined,
      unread_count_customer: 0,
      unread_count_provider: 0,
      unread_count_admin: 0,
      moderation: {
        isFlagged: r.status === 'flagged',
        riskScore: r.status === 'flagged' ? 85 : 0,
        flaggedReasons: [],
        notes: [],
      },
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at),
    }));
  }

  static async findAdminConversations(options: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ conversations: ConversationEntity[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (options.status && options.status !== 'all') {
      values.push(options.status);
      conditions.push(`c.status = $${values.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    values.push(limit, offset);

    const [convRes, countRes] = await Promise.all([
      this.pool.query(
        `SELECT c.*,
                b.booking_id AS display_booking_id,
                cu.id AS cust_id, cu.name AS cust_name, cu.phone AS cust_phone,
                pr.id AS prov_id, pr.name AS prov_name, pr.phone AS prov_phone,
                (SELECT message FROM booking.chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS latest_message,
                (SELECT created_at FROM booking.chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS latest_message_at
         FROM booking.conversations c
         LEFT JOIN booking.bookings b ON b.id = c.booking_id
         LEFT JOIN auth.users cu ON cu.id = b.user_id
         LEFT JOIN auth.users pr ON pr.id = b.provider_id
         ${where}
         ORDER BY c.updated_at DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values
      ),
      this.pool.query(`SELECT COUNT(*)::int AS total FROM booking.conversations c ${where}`, values.slice(0, values.length - 2)),
    ]);

    const conversations = convRes.rows.map(r => ({
      id: String(r.id),
      _id: String(r.id),
      conversation_id: String(r.id),
      conversationId: String(r.id),
      booking_id: r.display_booking_id || (r.booking_id ? String(r.booking_id) : undefined),
      bookingId: r.display_booking_id || (r.booking_id ? String(r.booking_id) : undefined),
      status: r.status,
      customer: r.cust_id ? { id: String(r.cust_id), name: r.cust_name || 'Customer', phone: r.cust_phone } : undefined,
      provider: r.prov_id ? { id: String(r.prov_id), name: r.prov_name || 'Provider', phone: r.prov_phone } : undefined,
      last_message: r.latest_message || undefined,
      last_message_at: r.latest_message_at ? new Date(r.latest_message_at) : undefined,
      unread_count_customer: 0,
      unread_count_provider: 0,
      unread_count_admin: 0,
      moderation: {
        isFlagged: r.status === 'flagged',
        riskScore: r.status === 'flagged' ? 85 : 0,
        flaggedReasons: [],
        notes: [],
      },
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at),
    }));

    return {
      conversations,
      total: countRes.rows[0]?.total || 0,
    };
  }

  static async getChatStats(): Promise<{ activeCount: number; flaggedCount: number; resolvedCount: number; totalCount: number }> {
    const res = await this.pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'active')::int AS active_count,
         COUNT(*) FILTER (WHERE status = 'flagged')::int AS flagged_count,
         COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved_count,
         COUNT(*)::int AS total_count
       FROM booking.conversations`
    );
    const r = res.rows[0] || {};
    return {
      activeCount: Number(r.active_count || 0),
      flaggedCount: Number(r.flagged_count || 0),
      resolvedCount: Number(r.resolved_count || 0),
      totalCount: Number(r.total_count || 0),
    };
  }

  static async updateStatus(conversationId: string, status: string): Promise<void> {
    await this.pool.query(
      `UPDATE booking.conversations SET status = $1, updated_at = NOW() WHERE id::text = $2 OR legacy_mongo_id = $2`,
      [status, conversationId]
    );
  }

  static async deleteMessage(messageId: string): Promise<void> {
    await this.pool.query(
      `UPDATE booking.chat_messages SET message = '[Message deleted by Admin Moderation]' WHERE id::text = $1 OR legacy_mongo_id = $1`,
      [messageId]
    );
  }
}
