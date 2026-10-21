import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface BookingEntity {
  id: string;
  _id: string;
  booking_id: string;
  bookingId: string;
  user_id: string;
  userId: string;
  subservice_id: string;
  subserviceId: string;
  provider_id?: string;
  providerId?: string;
  address_id: string;
  addressId: string;
  scheduled_at: Date;
  scheduledAt: Date;
  time_slot: string;
  timeSlot: string;
  status: string;
  payment_status: string;
  paymentStatus: string;
  finance_status: string;
  financeStatus: string;
  refund_status: string;
  refundStatus: string;
  base_price: number;
  basePrice: number;
  final_amount: number;
  finalAmount: number;
  total_amount: number;
  totalAmount: number;
  payable_amount: number;
  payableAmount: number;
  discount_amount: number;
  discountAmount: number;
  platform_fee: number;
  platformFee: number;
  taxes: number;
  currency: string;
  otp?: string;
  start_otp?: string;
  startOtp?: string;
  end_otp?: string;
  endOtp?: string;
  startOtpGeneratedAt?: Date;
  endOtpGeneratedAt?: Date;
  startOtpAttempts?: number;
  endOtpAttempts?: number;
  cancelled_by?: string;
  cancelledBy?: string;
  cancel_reason?: string;
  cancelReason?: string;
  cancel_reason_category?: string;
  cancelled_at?: Date;
  accepted_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  preferred_gender?: string;
  preferredGender?: string;
  instructions?: string;
  customer_note?: string;
  is_reviewed: boolean;
  isReviewed: boolean;
  version: number;
  payment_collection?: any;
  activities?: any[];
  user?: any;
  customer?: any;
  provider?: any;
  subservice?: any;
  address?: any;
  created_at: Date;
  createdAt: Date;
  updated_at: Date;
  updatedAt: Date;
}

export const mapBookingRow = (row: any): BookingEntity => {
  if (!row) return null as any;
  const idStr = String(row.id);
  const uIdStr = String(row.user_id);
  const subIdStr = String(row.subservice_id);
  const provIdStr = row.provider_id ? String(row.provider_id) : undefined;
  const addrIdStr = String(row.address_id);
  const baseP = parseFloat(row.base_price || 0);
  const finalP = parseFloat(row.final_amount || row.total_amount || 0);
  const totalP = parseFloat(row.total_amount || row.final_amount || 0);
  const payableP = parseFloat(row.payable_amount || finalP);
  const discP = parseFloat(row.discount_amount || 0);
  const feeP = parseFloat(row.platform_fee || 0);
  const taxP = parseFloat(row.taxes || 0);
  const vers = Number(row.version) || 1;

  const entity: BookingEntity = {
    id: idStr,
    _id: idStr,
    booking_id: row.booking_id,
    bookingId: row.booking_id,
    user_id: uIdStr,
    userId: uIdStr,
    subservice_id: subIdStr,
    subserviceId: subIdStr,
    provider_id: provIdStr,
    providerId: provIdStr,
    address_id: addrIdStr,
    addressId: addrIdStr,
    scheduled_at: new Date(row.scheduled_at),
    scheduledAt: new Date(row.scheduled_at),
    time_slot: row.time_slot,
    timeSlot: row.time_slot,
    status: row.status,
    payment_status: row.payment_status || 'pending',
    paymentStatus: row.payment_status || 'pending',
    finance_status: row.finance_status || 'pending',
    financeStatus: row.finance_status || 'pending',
    refund_status: row.refund_status || 'none',
    refundStatus: row.refund_status || 'none',
    base_price: baseP,
    basePrice: baseP,
    final_amount: finalP,
    finalAmount: finalP,
    total_amount: totalP,
    totalAmount: totalP,
    payable_amount: payableP,
    payableAmount: payableP,
    discount_amount: discP,
    discountAmount: discP,
    platform_fee: feeP,
    platformFee: feeP,
    taxes: taxP,
    currency: row.currency || 'INR',
    otp: row.otp || undefined,
    start_otp: row.start_otp || undefined,
    startOtp: row.start_otp || undefined,
    end_otp: row.end_otp || undefined,
    endOtp: row.end_otp || undefined,
    startOtpGeneratedAt: row.start_otp_generated_at ? new Date(row.start_otp_generated_at) : undefined,
    endOtpGeneratedAt: row.end_otp_generated_at ? new Date(row.end_otp_generated_at) : undefined,
    startOtpAttempts: Number(row.start_otp_attempts) || 0,
    endOtpAttempts: Number(row.end_otp_attempts) || 0,
    cancelled_by: row.cancelled_by || undefined,
    cancelledBy: row.cancelled_by || undefined,
    cancel_reason: row.cancel_reason || undefined,
    cancelReason: row.cancel_reason || undefined,
    cancel_reason_category: row.cancel_reason_category || undefined,
    cancelled_at: row.cancelled_at ? new Date(row.cancelled_at) : undefined,
    accepted_at: row.accepted_at ? new Date(row.accepted_at) : undefined,
    started_at: row.started_at ? new Date(row.started_at) : undefined,
    completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
    preferred_gender: row.preferred_gender || 'ANY',
    preferredGender: row.preferred_gender || 'ANY',
    instructions: row.instructions || undefined,
    customer_note: row.customer_note || undefined,
    is_reviewed: Boolean(row.is_reviewed),
    isReviewed: Boolean(row.is_reviewed),
    version: vers,
    created_at: new Date(row.created_at || Date.now()),
    createdAt: new Date(row.created_at || Date.now()),
    updated_at: new Date(row.updated_at || Date.now()),
    updatedAt: new Date(row.updated_at || Date.now()),
  };

  // Payment collection mapping
  if (row.payment_collection_status) {
    entity.payment_collection = {
      status: row.payment_collection_status,
      method: row.payment_collection_method,
      final_amount: parseFloat(row.payment_collection_final_amount || finalP),
      collected_amount: parseFloat(row.payment_collection_collected_amount || 0),
      remaining_amount: parseFloat(row.payment_collection_remaining_amount || 0),
      confirmed_by: row.payment_collection_confirmed_by,
      transaction_id: row.payment_collection_tx_id,
      expires_at: row.payment_collection_expires_at ? new Date(row.payment_collection_expires_at) : undefined,
    };
  }

  // User / Customer populated
  if (row.customer_name || row.customer_phone) {
    entity.user = {
      _id: uIdStr,
      id: uIdStr,
      name: row.customer_name || 'Customer',
      phone: row.customer_phone || '',
      email: row.customer_email || '',
    };
    entity.customer = entity.user;
  }

  // Provider populated
  if (provIdStr && (row.provider_name || row.provider_phone)) {
    entity.provider = {
      _id: provIdStr,
      id: provIdStr,
      name: row.provider_name || 'Provider',
      phone: row.provider_phone || '',
      profile_picture: row.provider_profile_picture || '',
    };
  }

  // Subservice populated
  if (row.subservice_name) {
    entity.subservice = {
      _id: subIdStr,
      id: subIdStr,
      name: row.subservice_name,
      subservice_name: row.subservice_name,
      base_price: parseFloat(row.subservice_base_price || 0),
      service_name: row.service_name || '',
      category_name: row.category_name || '',
    };
  }

  // Address populated
  if (row.address_line1 || row.city) {
    entity.address = {
      _id: addrIdStr,
      id: addrIdStr,
      address_line1: row.address_line1,
      address_line2: row.address_line2,
      city: row.city,
      state: row.state,
      pincode: row.pincode,
      landmark: row.landmark,
      latitude: row.latitude ? parseFloat(row.latitude) : undefined,
      longitude: row.longitude ? parseFloat(row.longitude) : undefined,
    };
  }

  // Activities array
  if (Array.isArray(row.activities)) {
    entity.activities = row.activities;
  }

  return entity;
};

export class BookingRepository {
  private static get pool(): Pool {
    return getDb();
  }

  private static get baseSelectQuery(): string {
    return `
      SELECT b.*,
             u.name AS customer_name,
             u.phone AS customer_phone,
             u.email AS customer_email,
             p.name AS provider_name,
             p.phone AS provider_phone,
             ss.subservice_name,
             ss.base_price AS subservice_base_price,
             srv.service_name,
             cat.name AS category_name,
             addr.address_line_1 AS address_line1,
             addr.address_line_2 AS address_line2,
             addr.city,
             addr.state,
             addr.pincode,
             addr.landmark,
             addr.latitude,
             addr.longitude,
             pc.status AS payment_collection_status,
             pc.method AS payment_collection_method,
             pc.final_amount AS payment_collection_final_amount,
             pc.collected_amount AS payment_collection_collected_amount,
             pc.remaining_amount AS payment_collection_remaining_amount,
             pc.confirmed_by AS payment_collection_confirmed_by,
             pc.transaction_id AS payment_collection_tx_id,
             pc.expires_at AS payment_collection_expires_at,
             COALESCE((
               SELECT json_agg(json_build_object(
                 'id', ba.id, 'action', ba.action, 'actor', ba.actor,
                 'details', ba.details, 'created_at', ba.created_at
               ) ORDER BY ba.created_at DESC)
               FROM booking.booking_activities ba
               WHERE ba.booking_id = b.id
             ), '[]'::json) AS activities
      FROM booking.bookings b
      LEFT JOIN auth.users u ON u.id = b.user_id
      LEFT JOIN auth.users p ON p.id = b.provider_id
      LEFT JOIN catalog.subservices ss ON ss.id = b.subservice_id
      LEFT JOIN catalog.services srv ON srv.id = ss.service_id
      LEFT JOIN catalog.categories cat ON cat.id = srv.category_id
      LEFT JOIN auth.addresses addr ON addr.id = b.address_id
      LEFT JOIN booking.booking_payment_collections pc ON pc.booking_id = b.id
    `;
  }

  static async findById(id: string): Promise<BookingEntity | null> {
    if (!id) return null;
    const res = await this.pool.query(
      `${this.baseSelectQuery}
       WHERE (b.id::text = $1 OR b.legacy_mongo_id = $1 OR b.booking_id = $1)
         AND b.deleted_at IS NULL
       LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapBookingRow(res.rows[0]) : null;
  }

  static async findByBookingId(bookingId: string): Promise<BookingEntity | null> {
    if (!bookingId) return null;
    const res = await this.pool.query(
      `${this.baseSelectQuery}
       WHERE b.booking_id = $1 AND b.deleted_at IS NULL
       LIMIT 1`,
      [bookingId]
    );
    return res.rows[0] ? mapBookingRow(res.rows[0]) : null;
  }

  static async findBookings(filters: {
    userId?: string;
    providerId?: string;
    status?: string | string[];
    paymentStatus?: string;
    financeStatus?: string;
    scheduledFrom?: Date;
    scheduledTo?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ bookings: BookingEntity[]; total: number }> {
    const conditions: string[] = ['b.deleted_at IS NULL'];
    const values: any[] = [];

    if (filters.userId) {
      values.push(filters.userId);
      conditions.push(`(b.user_id::text = $${values.length} OR u.legacy_mongo_id = $${values.length})`);
    }

    if (filters.providerId) {
      values.push(filters.providerId);
      conditions.push(`(b.provider_id::text = $${values.length} OR p.legacy_mongo_id = $${values.length})`);
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        values.push(filters.status);
        conditions.push(`b.status = ANY($${values.length})`);
      } else {
        values.push(filters.status);
        conditions.push(`b.status = $${values.length}`);
      }
    }

    if (filters.paymentStatus) {
      values.push(filters.paymentStatus);
      conditions.push(`b.payment_status = $${values.length}`);
    }

    if (filters.financeStatus) {
      values.push(filters.financeStatus);
      conditions.push(`b.finance_status = $${values.length}`);
    }

    if (filters.scheduledFrom) {
      values.push(filters.scheduledFrom);
      conditions.push(`b.scheduled_at >= $${values.length}`);
    }

    if (filters.scheduledTo) {
      values.push(filters.scheduledTo);
      conditions.push(`b.scheduled_at <= $${values.length}`);
    }

    const whereClause = conditions.join(' AND ');

    // Count
    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int AS total
       FROM booking.bookings b
       LEFT JOIN auth.users u ON u.id = b.user_id
       LEFT JOIN auth.users p ON p.id = b.provider_id
       WHERE ${whereClause}`,
      values
    );
    const total = countRes.rows[0]?.total || 0;

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    values.push(limit, offset);
    const query = `
      ${this.baseSelectQuery}
      WHERE ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `;

    const res = await this.pool.query(query, values);
    return {
      bookings: res.rows.map(mapBookingRow),
      total,
    };
  }

  static async create(data: {
    bookingId?: string;
    userId: string;
    subserviceId: string;
    providerId?: string;
    addressId: string;
    scheduledAt: Date;
    timeSlot: string;
    status?: string;
    paymentStatus?: string;
    basePrice: number;
    finalAmount: number;
    totalAmount: number;
    payableAmount?: number;
    discountAmount?: number;
    platformFee?: number;
    taxes?: number;
    otp?: string;
    preferredGender?: string;
    instructions?: string;
    customerNote?: string;
    idempotencyKey?: string;
  }): Promise<BookingEntity> {
    const displayId = data.bookingId || `BK-${Date.now().toString().slice(-8)}-${Math.floor(100 + Math.random() * 900)}`;

    const res = await this.pool.query(
      `INSERT INTO booking.bookings (
         booking_id, user_id, subservice_id, provider_id, address_id,
         scheduled_at, time_slot, status, payment_status,
         base_price, final_amount, total_amount, payable_amount, discount_amount,
         platform_fee, taxes, otp, preferred_gender, instructions, customer_note,
         idempotency_key, version
       ) VALUES (
         $1,
         (SELECT id FROM auth.users WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1),
         (SELECT id FROM catalog.subservices WHERE id::text = $3 OR legacy_mongo_id = $3 LIMIT 1),
         (SELECT id FROM auth.users WHERE id::text = $4 OR legacy_mongo_id = $4 LIMIT 1),
         (SELECT id FROM auth.addresses WHERE id::text = $5 OR legacy_mongo_id = $5 LIMIT 1),
         $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 1
       ) RETURNING id`,
      [
        displayId,
        data.userId,
        data.subserviceId,
        data.providerId || null,
        data.addressId,
        data.scheduledAt,
        data.timeSlot,
        data.status || 'pending',
        data.paymentStatus || 'pending',
        data.basePrice,
        data.finalAmount,
        data.totalAmount,
        data.payableAmount ?? data.finalAmount,
        data.discountAmount || 0,
        data.platformFee || 0,
        data.taxes || 0,
        data.otp || null,
        data.preferredGender || 'ANY',
        data.instructions || null,
        data.customerNote || null,
        data.idempotencyKey || null,
      ]
    );

    return this.findById(res.rows[0].id) as Promise<BookingEntity>;
  }

  /**
   * CRITICAL REQUIREMENT: Atomic cancellation with optimistic concurrency version check
   */
  static async atomicCancel(
    bookingId: string,
    expectedVersion: number,
    cancelledBy: 'customer' | 'provider' | 'admin',
    cancelReason?: string,
    cancelCategory?: string
  ): Promise<BookingEntity | null> {
    const res = await this.pool.query(
      `UPDATE booking.bookings
       SET status = 'cancelled',
           cancelled_by = $3,
           cancel_reason = $4,
           cancel_reason_category = $5,
           cancelled_at = NOW(),
           version = version + 1,
           updated_at = NOW()
       WHERE (id::text = $1 OR legacy_mongo_id = $1 OR booking_id = $1)
         AND version = $2
         AND status IN ('pending', 'confirmed', 'scheduled', 'provider_searching', 'assigned', 'accepted')
       RETURNING id`,
      [
        bookingId,
        expectedVersion,
        cancelledBy,
        cancelReason || 'Cancelled by ' + cancelledBy,
        cancelCategory || 'other',
      ]
    );

    if (res.rows.length === 0) {
      return null;
    }

    return this.findById(res.rows[0].id);
  }

  /**
   * Atomic status transition with optional expectedVersion guard
   */
  static async atomicStatusTransition(
    bookingId: string,
    fromStatuses: string[],
    toStatus: string,
    updates: Record<string, any> = {},
    expectedVersion?: number
  ): Promise<BookingEntity | null> {
    const conditions: string[] = [
      `(id::text = $1 OR legacy_mongo_id = $1 OR booking_id = $1)`,
      `status = ANY($2)`
    ];
    const values: any[] = [bookingId, fromStatuses, toStatus];

    const setClauses: string[] = [
      `status = $3`,
      `version = version + 1`,
      `updated_at = NOW()`,
    ];

    if (expectedVersion !== undefined) {
      values.push(expectedVersion);
      conditions.push(`version = $${values.length}`);
    }

    const fieldMap: Record<string, string> = {
      provider_id: 'provider_id',
      providerId: 'provider_id',
      payment_status: 'payment_status',
      paymentStatus: 'payment_status',
      finance_status: 'finance_status',
      financeStatus: 'finance_status',
      refund_status: 'refund_status',
      refundStatus: 'refund_status',
      accepted_at: 'accepted_at',
      started_at: 'started_at',
      completed_at: 'completed_at',
      start_otp: 'start_otp',
      startOtp: 'start_otp',
      end_otp: 'end_otp',
      endOtp: 'end_otp',
    };

    for (const [k, v] of Object.entries(updates)) {
      const col = fieldMap[k];
      if (col && v !== undefined) {
        values.push(v);
        setClauses.push(`${col} = $${values.length}`);
      }
    }

    const res = await this.pool.query(
      `UPDATE booking.bookings
       SET ${setClauses.join(', ')}
       WHERE ${conditions.join(' AND ')}
       RETURNING id`,
      values
    );

    if (res.rows.length === 0) return null;
    return this.findById(res.rows[0].id);
  }

  static async update(id: string, updates: Record<string, any>): Promise<BookingEntity | null> {
    const fieldMap: Record<string, string> = {
      status: 'status',
      payment_status: 'payment_status',
      paymentStatus: 'payment_status',
      finance_status: 'finance_status',
      financeStatus: 'finance_status',
      refund_status: 'refund_status',
      refundStatus: 'refund_status',
      provider_id: 'provider_id',
      providerId: 'provider_id',
      accepted_at: 'accepted_at',
      started_at: 'started_at',
      completed_at: 'completed_at',
      cancelled_at: 'cancelled_at',
      cancelled_by: 'cancelled_by',
      cancelledBy: 'cancelled_by',
      cancel_reason: 'cancel_reason',
      cancelReason: 'cancel_reason',
      start_otp: 'start_otp',
      startOtp: 'start_otp',
      end_otp: 'end_otp',
      endOtp: 'end_otp',
      is_reviewed: 'is_reviewed',
      isReviewed: 'is_reviewed',
      payable_amount: 'payable_amount',
      payableAmount: 'payable_amount',
    };

    const setClauses: string[] = ['version = version + 1', 'updated_at = NOW()'];
    const values: any[] = [id];

    for (const [k, v] of Object.entries(updates)) {
      const col = fieldMap[k];
      if (col !== undefined && v !== undefined) {
        values.push(v);
        setClauses.push(`${col} = $${values.length}`);
      }
    }

    const res = await this.pool.query(
      `UPDATE booking.bookings
       SET ${setClauses.join(', ')}
       WHERE (id::text = $1 OR legacy_mongo_id = $1 OR booking_id = $1)
         AND deleted_at IS NULL
       RETURNING id`,
      values
    );

    if (res.rows.length === 0) return null;
    return this.findById(res.rows[0].id);
  }

  static async addActivity(
    bookingId: string,
    action: string,
    actor: 'customer' | 'provider' | 'admin' | 'system' = 'system',
    details?: any
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO booking.booking_activities (booking_id, action, actor, details)
       VALUES (
         (SELECT id FROM booking.bookings WHERE id::text = $1 OR legacy_mongo_id = $1 OR booking_id = $1 LIMIT 1),
         $2, $3, $4
       )`,
      [bookingId, action, actor, details ? JSON.stringify(details) : null]
    );
  }

  static async updatePaymentCollection(
    bookingId: string,
    data: {
      status: string;
      method?: string;
      finalAmount?: number;
      collectedAmount?: number;
      remainingAmount?: number;
      confirmedBy?: string;
      transactionId?: string;
      expiresAt?: Date;
    }
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO booking.booking_payment_collections (
         booking_id, status, method, final_amount, collected_amount, remaining_amount,
         confirmed_by, transaction_id, expires_at
       ) VALUES (
         (SELECT id FROM booking.bookings WHERE id::text = $1 OR legacy_mongo_id = $1 OR booking_id = $1 LIMIT 1),
         $2, $3, $4, $5, $6, $7, $8, $9
       )
       ON CONFLICT (booking_id) DO UPDATE SET
         status = EXCLUDED.status,
         method = COALESCE(EXCLUDED.method, booking.booking_payment_collections.method),
         final_amount = COALESCE(EXCLUDED.final_amount, booking.booking_payment_collections.final_amount),
         collected_amount = COALESCE(EXCLUDED.collected_amount, booking.booking_payment_collections.collected_amount),
         remaining_amount = COALESCE(EXCLUDED.remaining_amount, booking.booking_payment_collections.remaining_amount),
         confirmed_by = COALESCE(EXCLUDED.confirmed_by, booking.booking_payment_collections.confirmed_by),
         transaction_id = COALESCE(EXCLUDED.transaction_id, booking.booking_payment_collections.transaction_id),
         expires_at = COALESCE(EXCLUDED.expires_at, booking.booking_payment_collections.expires_at),
         version = booking.booking_payment_collections.version + 1,
         updated_at = NOW()`,
      [
        bookingId,
        data.status,
        data.method || null,
        data.finalAmount || 0,
        data.collectedAmount || 0,
        data.remainingAmount || 0,
        data.confirmedBy || null,
        data.transactionId || null,
        data.expiresAt || null,
      ]
    );
  }

  static async recordPaymentAudit(data: {
    bookingId: string;
    action: string;
    actor?: string;
    amount?: number;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO booking.payment_collection_audits (booking_id, action, actor, amount)
       VALUES (
         (SELECT id FROM booking.bookings WHERE id::text = $1 OR legacy_mongo_id = $1 OR booking_id = $1 LIMIT 1),
         $2, $3, $4
       )`,
      [data.bookingId, data.action, data.actor || 'system', data.amount || 0]
    );
  }

  // --- RECOVERY HELPERS FOR server.ts JOBS ---

  static async findStuckAccepted(thresholdDate: Date): Promise<BookingEntity[]> {
    const res = await this.pool.query(
      `${this.baseSelectQuery}
       WHERE b.status = 'accepted'
         AND b.accepted_at < $1
         AND b.deleted_at IS NULL`,
      [thresholdDate]
    );
    return res.rows.map(mapBookingRow);
  }

  static async findStuckStartOtp(thresholdDate: Date): Promise<BookingEntity[]> {
    const res = await this.pool.query(
      `${this.baseSelectQuery}
       WHERE b.status = 'waiting_start_otp'
         AND b.start_otp_generated_at < $1
         AND b.deleted_at IS NULL`,
      [thresholdDate]
    );
    return res.rows.map(mapBookingRow);
  }

  static async findStuckEndOtp(thresholdDate: Date): Promise<BookingEntity[]> {
    const res = await this.pool.query(
      `${this.baseSelectQuery}
       WHERE b.status = 'waiting_end_otp'
         AND b.end_otp_generated_at < $1
         AND b.deleted_at IS NULL`,
      [thresholdDate]
    );
    return res.rows.map(mapBookingRow);
  }

  static async findExpiredPayments(now: Date): Promise<BookingEntity[]> {
    const res = await this.pool.query(
      `${this.baseSelectQuery}
       WHERE b.status = 'service_completed'
         AND pc.status IN ('pending', 'upi_pending')
         AND pc.expires_at < $1
         AND b.deleted_at IS NULL`,
      [now]
    );
    return res.rows.map(mapBookingRow);
  }
}
