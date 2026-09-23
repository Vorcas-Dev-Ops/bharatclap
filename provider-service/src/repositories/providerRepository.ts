import { Pool, PoolClient } from 'pg';
import { getDb } from '../config/db';

export interface ProviderEntity {
  id: string;
  _id: string;
  user_id: string;
  userId: string;
  provider_code?: string;
  providerCode?: string;
  availability_status: 'available' | 'busy' | 'offline' | 'break' | 'vacation' | 'blocked';
  status: 'active' | 'suspended' | 'blocked';
  is_online: boolean;
  is_busy: boolean;
  kyc_status: 'pending' | 'verified' | 'rejected';
  is_verified: boolean;
  gender?: string;
  wallet_balance: number;
  walletBalance: number;
  reserved_balance: number;
  credit_limit: number;
  is_wallet_blocked: boolean;
  wallet_status: string;
  wallet_version: number;
  fencing_token: number;
  currency: string;
  rating_count: number;
  average_rating: number;
  rating_sum: number;
  total_rated_jobs: number;
  live_location?: {
    latitude: number;
    longitude: number;
  };
  service_radius: number;
  subscription_type?: string;
  subscription_status?: string;
  subscription_start_date?: Date;
  subscription_end_date?: Date;
  subscription_auto_renew: boolean;
  grace_period_end?: Date;
  total_bookings: number;
  successful_bookings: number;
  cancellation_count: number;
  cod_due_balance: number;
  is_dispatch_blocked_by_cod: boolean;
  onboarding_status: 'DRAFT' | 'UNDER_REVIEW' | 'ACTION_REQUIRED' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  onboarding_step: number;
  onboarding_draft?: any;
  razorpay_contact_id?: string;
  razorpay_fund_account_id?: string;
  razorpay_account_status?: string;
  version: number;
  legacy_mongo_id?: string;
  created_at: Date;
  updated_at: Date;
  bank_details?: {
    account_holder_name: string;
    account_number_last4?: string;
    ifsc_code: string;
    bank_name?: string;
    branch?: string;
    status: string;
    verified_at?: Date;
  };
}

export const mapProviderRow = (row: any): ProviderEntity => {
  if (!row) return null as any;
  const idStr = String(row.id);
  const userIdStr = String(row.user_id);

  let live_location: { latitude: number; longitude: number } | undefined = undefined;
  if (row.latitude !== null && row.longitude !== null && row.latitude !== undefined && row.longitude !== undefined) {
    live_location = {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    };
  }

  return {
    id: idStr,
    _id: idStr,
    user_id: userIdStr,
    userId: userIdStr,
    provider_code: row.provider_code,
    providerCode: row.provider_code,
    availability_status: row.availability_status || 'offline',
    status: row.status || 'active',
    is_online: Boolean(row.is_online),
    is_busy: Boolean(row.is_busy),
    kyc_status: row.kyc_status || 'pending',
    is_verified: Boolean(row.is_verified),
    gender: row.gender,
    wallet_balance: Number(row.wallet_balance) || 0,
    walletBalance: Number(row.wallet_balance) || 0,
    reserved_balance: Number(row.reserved_balance) || 0,
    credit_limit: Number(row.credit_limit) || 0,
    is_wallet_blocked: Boolean(row.is_wallet_blocked),
    wallet_status: row.wallet_status || 'active',
    wallet_version: Number(row.wallet_version) || 0,
    fencing_token: Number(row.fencing_token) || 0,
    currency: row.currency || 'INR',
    rating_count: Number(row.rating_count) || 0,
    average_rating: Number(row.average_rating) || 4.5,
    rating_sum: Number(row.rating_sum) || 0,
    total_rated_jobs: Number(row.total_rated_jobs) || 0,
    live_location,
    service_radius: Number(row.service_radius) || 10000,
    subscription_type: row.subscription_type,
    subscription_status: row.subscription_status,
    subscription_start_date: row.subscription_start_date ? new Date(row.subscription_start_date) : undefined,
    subscription_end_date: row.subscription_end_date ? new Date(row.subscription_end_date) : undefined,
    subscription_auto_renew: Boolean(row.subscription_auto_renew),
    grace_period_end: row.grace_period_end ? new Date(row.grace_period_end) : undefined,
    total_bookings: Number(row.total_bookings) || 0,
    successful_bookings: Number(row.successful_bookings) || 0,
    cancellation_count: Number(row.cancellation_count) || 0,
    cod_due_balance: Number(row.cod_due_balance) || 0,
    is_dispatch_blocked_by_cod: Boolean(row.is_dispatch_blocked_by_cod),
    onboarding_status: row.onboarding_status || 'DRAFT',
    onboarding_step: Number(row.onboarding_step) || 0,
    onboarding_draft: row.onboarding_draft,
    razorpay_contact_id: row.razorpay_contact_id,
    razorpay_fund_account_id: row.razorpay_fund_account_id,
    razorpay_account_status: row.razorpay_account_status,
    version: Number(row.version) || 1,
    legacy_mongo_id: row.legacy_mongo_id,
    created_at: new Date(row.created_at || Date.now()),
    updated_at: new Date(row.updated_at || Date.now()),
    bank_details: row.account_holder_name ? {
      account_holder_name: row.account_holder_name,
      account_number_last4: row.account_number_last4,
      ifsc_code: row.ifsc_code,
      bank_name: row.bank_name,
      branch: row.branch,
      status: row.bank_status || 'pending',
      verified_at: row.bank_verified_at ? new Date(row.bank_verified_at) : undefined,
    } : undefined
  };
};

const BASE_PROVIDER_SELECT = `
  SELECT 
    p.*,
    ST_Y(p.live_location::geometry) AS latitude,
    ST_X(p.live_location::geometry) AS longitude,
    b.account_holder_name,
    b.account_number_last4,
    b.ifsc_code,
    b.bank_name,
    b.branch,
    b.status AS bank_status,
    b.verified_at AS bank_verified_at
  FROM provider.providers p
  LEFT JOIN provider.provider_bank_details b ON b.provider_id = p.id
`;

export class ProviderRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findById(id: string, client?: PoolClient): Promise<ProviderEntity | null> {
    const q = client || this.pool;
    const res = await q.query(
      `${BASE_PROVIDER_SELECT}
       WHERE (p.id::text = $1 OR p.legacy_mongo_id = $1)
         AND p.deleted_at IS NULL
       LIMIT 1`,
      [id]
    );
    return res.rows[0] ? mapProviderRow(res.rows[0]) : null;
  }

  static async findByUserId(userId: string, client?: PoolClient): Promise<ProviderEntity | null> {
    const q = client || this.pool;
    const res = await q.query(
      `${BASE_PROVIDER_SELECT}
       WHERE (p.user_id::text = $1 OR p.legacy_mongo_id = $1)
         AND p.deleted_at IS NULL
       LIMIT 1`,
      [userId]
    );
    return res.rows[0] ? mapProviderRow(res.rows[0]) : null;
  }

  static async findByProviderCode(code: string): Promise<ProviderEntity | null> {
    const res = await this.pool.query(
      `${BASE_PROVIDER_SELECT}
       WHERE p.provider_code = $1
         AND p.deleted_at IS NULL
       LIMIT 1`,
      [code]
    );
    return res.rows[0] ? mapProviderRow(res.rows[0]) : null;
  }

  static async findByIds(ids: string[]): Promise<ProviderEntity[]> {
    if (!ids || ids.length === 0) return [];
    const res = await this.pool.query(
      `${BASE_PROVIDER_SELECT}
       WHERE (p.id::text = ANY($1) OR p.legacy_mongo_id = ANY($1) OR p.user_id::text = ANY($1))
         AND p.deleted_at IS NULL`,
      [ids]
    );
    return res.rows.map(mapProviderRow);
  }

  /**
   * PostGIS geospatial candidate query: finds active, verified, online providers within radiusMeters.
   */
  static async findNearby(options: {
    latitude: number;
    longitude: number;
    radiusMeters?: number;
    subserviceId?: string;
    onlyAvailable?: boolean;
    gender?: string;
  }): Promise<(ProviderEntity & { distance_meters: number })[]> {
    const radius = options.radiusMeters || 10000;
    const conditions: string[] = [
      `p.deleted_at IS NULL`,
      `p.status = 'active'`,
      `p.kyc_status = 'verified'`,
      `p.is_online = TRUE`,
      `p.live_location IS NOT NULL`,
      `ST_DWithin(p.live_location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)`
    ];
    const values: any[] = [options.longitude, options.latitude, radius];

    if (options.onlyAvailable) {
      conditions.push(`p.availability_status = 'available' AND p.is_busy = FALSE`);
    }

    if (options.gender && options.gender !== 'ANY') {
      values.push(options.gender);
      conditions.push(`p.gender = $${values.length}`);
    }

    let joinSubservice = '';
    if (options.subserviceId) {
      values.push(options.subserviceId);
      joinSubservice = `
        INNER JOIN provider.provider_services ps ON ps.provider_id = p.id AND ps.is_active = TRUE
        INNER JOIN provider.provider_service_subservices pss ON pss.provider_service_id = ps.id AND (pss.subservice_id::text = $${values.length})
      `;
    }

    const query = `
      SELECT 
        p.*,
        ST_Y(p.live_location::geometry) AS latitude,
        ST_X(p.live_location::geometry) AS longitude,
        b.account_holder_name,
        b.account_number_last4,
        b.ifsc_code,
        b.bank_name,
        b.branch,
        b.status AS bank_status,
        b.verified_at AS bank_verified_at,
        ST_Distance(p.live_location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)::int AS distance_meters
      FROM provider.providers p
      LEFT JOIN provider.provider_bank_details b ON b.provider_id = p.id
      ${joinSubservice}
      WHERE ${conditions.join(' AND ')}
      ORDER BY distance_meters ASC
      LIMIT 50
    `;

    const res = await this.pool.query(query, values);
    return res.rows.map(row => ({
      ...mapProviderRow(row),
      distance_meters: Number(row.distance_meters) || 0
    }));
  }

  static async updateLocation(providerId: string, latitude: number, longitude: number): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE provider.providers
       SET live_location = ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
           updated_at = NOW()
       WHERE (id::text = $3 OR legacy_mongo_id = $3)`,
      [latitude, longitude, providerId]
    );
    return (res.rowCount || 0) > 0;
  }

  static async updateAvailability(providerId: string, availabilityStatus: string, isOnline?: boolean, isBusy?: boolean): Promise<ProviderEntity | null> {
    const setClauses: string[] = [`availability_status = $2`, `updated_at = NOW()`, `version = version + 1`];
    const values: any[] = [providerId, availabilityStatus];

    if (isOnline !== undefined) {
      values.push(isOnline);
      setClauses.push(`is_online = $${values.length}`);
    }
    if (isBusy !== undefined) {
      values.push(isBusy);
      setClauses.push(`is_busy = $${values.length}`);
    }

    const res = await this.pool.query(
      `UPDATE provider.providers
       SET ${setClauses.join(', ')}
       WHERE (id::text = $1 OR legacy_mongo_id = $1)
       RETURNING id`,
      values
    );

    return res.rows[0] ? this.findById(res.rows[0].id) : null;
  }

  static async updateKyc(providerId: string, kycStatus: string, isVerified: boolean): Promise<ProviderEntity | null> {
    const res = await this.pool.query(
      `UPDATE provider.providers
       SET kyc_status = $2, is_verified = $3, updated_at = NOW(), version = version + 1
       WHERE (id::text = $1 OR legacy_mongo_id = $1)
       RETURNING id`,
      [providerId, kycStatus, isVerified]
    );
    return res.rows[0] ? this.findById(res.rows[0].id) : null;
  }

  static async updateOnboarding(providerId: string, onboardingStatus: string, step?: number, draft?: any): Promise<ProviderEntity | null> {
    const setClauses = [`onboarding_status = $2`, `updated_at = NOW()`, `version = version + 1`];
    const values: any[] = [providerId, onboardingStatus];

    if (step !== undefined) {
      values.push(step);
      setClauses.push(`onboarding_step = $${values.length}`);
    }
    if (draft !== undefined) {
      values.push(JSON.stringify(draft));
      setClauses.push(`onboarding_draft = $${values.length}::jsonb`);
    }

    const res = await this.pool.query(
      `UPDATE provider.providers
       SET ${setClauses.join(', ')}
       WHERE (id::text = $1 OR legacy_mongo_id = $1)
       RETURNING id`,
      values
    );
    return res.rows[0] ? this.findById(res.rows[0].id) : null;
  }

  static async updateRating(providerId: string, rating: number): Promise<void> {
    await this.pool.query(
      `UPDATE provider.providers
       SET rating_count = rating_count + 1,
           total_rated_jobs = total_rated_jobs + 1,
           rating_sum = rating_sum + $2,
           average_rating = ROUND(((rating_sum + $2) / (rating_count + 1))::numeric, 2),
           updated_at = NOW()
       WHERE (id::text = $1 OR legacy_mongo_id = $1)`,
      [providerId, rating]
    );
  }

  /**
   * Monotonic fencing token allocation
   */
  static async allocateFencingToken(providerId: string, client?: PoolClient): Promise<{ fencingToken: number; walletBalance: number }> {
    const q = client || this.pool;
    const res = await q.query(
      `UPDATE provider.providers
       SET fencing_token = fencing_token + 1,
           updated_at = NOW()
       WHERE (id::text = $1 OR legacy_mongo_id = $1)
       RETURNING fencing_token, wallet_balance`,
      [providerId]
    );
    if (res.rows.length === 0) {
      throw new Error(`Provider not found for fencing token allocation: ${providerId}`);
    }
    return {
      fencingToken: Number(res.rows[0].fencing_token),
      walletBalance: Number(res.rows[0].wallet_balance),
    };
  }

  static async create(data: {
    userId: string;
    providerCode?: string;
    gender?: string;
    onboardingStatus?: string;
  }): Promise<ProviderEntity> {
    const res = await this.pool.query(
      `INSERT INTO provider.providers (
         user_id, provider_code, gender, onboarding_status, wallet_balance, fencing_token, version
       ) VALUES (
         $1, $2, $3, COALESCE($4, 'DRAFT'), 0, 0, 1
       )
       RETURNING id`,
      [data.userId, data.providerCode || null, data.gender || null, data.onboardingStatus]
    );
    const created = await this.findById(res.rows[0].id);
    return created!;
  }
}
