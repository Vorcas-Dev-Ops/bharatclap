import { Pool, PoolClient } from 'pg';
import { getDb } from '../config/db';

export interface UserMembershipEntity {
  id: string;
  _id: string;
  user_id: string;
  userId: string;
  membership_id: string;
  membershipId: string;
  start_date: Date;
  startDate: Date;
  end_date: Date;
  endDate: Date;
  expiry_date: Date;
  purchase_date: Date;
  status: string;
  membership_status: string;
  payment_status: string;
  expiring_soon_reminder_sent?: boolean;
  created_at: Date;
  createdAt: Date;
  updated_at: Date;
  updatedAt: Date;
}

const mapMembershipRow = (r: any): UserMembershipEntity => ({
  id: String(r.id),
  _id: String(r.id),
  user_id: String(r.user_id),
  userId: String(r.user_id),
  membership_id: String(r.membership_id),
  membershipId: String(r.membership_id),
  start_date: new Date(r.start_date),
  startDate: new Date(r.start_date),
  end_date: new Date(r.end_date),
  endDate: new Date(r.end_date),
  expiry_date: new Date(r.end_date),
  purchase_date: new Date(r.start_date),
  status: r.status,
  membership_status: r.status,
  payment_status: 'paid',
  created_at: new Date(r.created_at),
  createdAt: new Date(r.created_at),
  updated_at: new Date(r.updated_at),
  updatedAt: new Date(r.updated_at),
});

export class MembershipRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async getActiveMembership(userId: string): Promise<UserMembershipEntity | null> {
    const res = await this.pool.query(
      `SELECT * FROM payment.user_memberships
       WHERE (user_id::text = $1 OR user_id IN (SELECT id FROM auth.users WHERE legacy_mongo_id = $1))
         AND status = 'active'
         AND end_date > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );
    return res.rows[0] ? mapMembershipRow(res.rows[0]) : null;
  }

  static async getMembershipsByPlan(params: {
    membershipId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ records: UserMembershipEntity[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.membershipId) {
      conditions.push(`membership_id::text = $${idx}`);
      values.push(params.membershipId);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int as count FROM payment.user_memberships ${whereClause}`,
      values
    );
    const total = countRes.rows[0]?.count || 0;

    const query = `
      SELECT * FROM payment.user_memberships
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    values.push(limit, offset);

    const res = await this.pool.query(query, values);
    return {
      records: res.rows.map(mapMembershipRow),
      total,
    };
  }

  static async getMembershipStats(): Promise<{ activeMembers: number; paidMemberships: any[] }> {
    const activeRes = await this.pool.query(
      `SELECT COUNT(*)::int as count FROM payment.user_memberships WHERE status = 'active'`
    );

    const paidRes = await this.pool.query(
      `SELECT membership_id FROM payment.user_memberships
       WHERE start_date >= NOW() - INTERVAL '30 days'`
    );

    return {
      activeMembers: activeRes.rows[0]?.count || 0,
      paidMemberships: paidRes.rows.map(r => ({ membership_id: r.membership_id })),
    };
  }

  static async purchaseMembership(data: {
    userId: string;
    membershipId: string;
    durationDays: number;
  }): Promise<UserMembershipEntity> {
    // 1. Expire existing active memberships
    await this.pool.query(
      `UPDATE payment.user_memberships
       SET status = 'expired', updated_at = NOW()
       WHERE (user_id::text = $1 OR user_id IN (SELECT id FROM auth.users WHERE legacy_mongo_id = $1))
         AND status = 'active'`,
      [data.userId]
    );

    // 2. Insert new membership
    const res = await this.pool.query(
      `INSERT INTO payment.user_memberships (
         user_id,
         membership_id,
         start_date,
         end_date,
         status
       ) VALUES (
         COALESCE(
           (SELECT id FROM auth.users WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
           '00000000-0000-0000-0000-000000000000'::uuid
         ),
         COALESCE(
           (SELECT id FROM catalog.membership_plans WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1),
           $2::uuid
         ),
         NOW(),
         NOW() + ($3 || ' days')::interval,
         'active'
       ) RETURNING *`,
      [data.userId, data.membershipId, data.durationDays]
    );

    return mapMembershipRow(res.rows[0]);
  }

  static async renewMembership(data: {
    userId: string;
    membershipId: string;
    durationDays: number;
  }): Promise<UserMembershipEntity> {
    const existing = await this.pool.query(
      `SELECT * FROM payment.user_memberships
       WHERE (user_id::text = $1 OR user_id IN (SELECT id FROM auth.users WHERE legacy_mongo_id = $1))
         AND (membership_id::text = $2 OR membership_id IN (SELECT id FROM catalog.membership_plans WHERE legacy_mongo_id = $2))
         AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [data.userId, data.membershipId]
    );

    if (existing.rows[0]) {
      const res = await this.pool.query(
        `UPDATE payment.user_memberships
         SET end_date = end_date + ($2 || ' days')::interval,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [existing.rows[0].id, data.durationDays]
      );
      return mapMembershipRow(res.rows[0]);
    }

    return this.purchaseMembership(data);
  }

  static async checkMembershipExpirations(): Promise<{
    expired: UserMembershipEntity[];
    expiringSoon: UserMembershipEntity[];
  }> {
    // 1. Mark expired
    const expiredRes = await this.pool.query(
      `UPDATE payment.user_memberships
       SET status = 'expired', updated_at = NOW()
       WHERE status = 'active' AND end_date < NOW()
       RETURNING *`
    );

    // 2. Fetch expiring soon (<= 3 days)
    const expiringSoonRes = await this.pool.query(
      `SELECT * FROM payment.user_memberships
       WHERE status = 'active' AND end_date >= NOW() AND end_date <= NOW() + INTERVAL '3 days'`
    );

    return {
      expired: expiredRes.rows.map(mapMembershipRow),
      expiringSoon: expiringSoonRes.rows.map(mapMembershipRow),
    };
  }
}
