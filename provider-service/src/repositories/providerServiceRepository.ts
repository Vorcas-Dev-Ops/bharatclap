import { Pool, PoolClient } from 'pg';
import { getDb } from '../config/db';

export interface ProviderServiceEntity {
  id: string;
  provider_id: string;
  price: number;
  discount_percentage: number;
  currency: string;
  is_active: boolean;
  subservice_ids: string[];
  created_at: Date;
  updated_at: Date;
}

export class ProviderServiceRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async getServicesForProvider(providerId: string): Promise<ProviderServiceEntity[]> {
    const res = await this.pool.query(
      `SELECT 
         ps.id, ps.provider_id, ps.price, ps.discount_percentage, ps.currency, ps.is_active, ps.created_at, ps.updated_at,
         COALESCE(array_agg(pss.subservice_id::text) FILTER (WHERE pss.subservice_id IS NOT NULL), '{}') AS subservice_ids
       FROM provider.provider_services ps
       LEFT JOIN provider.provider_service_subservices pss ON pss.provider_service_id = ps.id
       WHERE (ps.provider_id::text = $1 OR ps.provider_id IN (SELECT id FROM provider.providers WHERE legacy_mongo_id = $1))
       GROUP BY ps.id`,
      [providerId]
    );

    return res.rows.map(r => ({
      id: String(r.id),
      provider_id: String(r.provider_id),
      price: Number(r.price) || 0,
      discount_percentage: Number(r.discount_percentage) || 0,
      currency: r.currency || 'INR',
      is_active: Boolean(r.is_active),
      subservice_ids: r.subservice_ids || [],
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at)
    }));
  }

  static async addOrUpdateService(data: {
    providerId: string;
    subserviceIds: string[];
    price?: number;
    discountPercentage?: number;
  }, client?: PoolClient): Promise<ProviderServiceEntity> {
    const q = client || this.pool;
    const sRes = await q.query(
      `INSERT INTO provider.provider_services (
         provider_id, price, discount_percentage, is_active
       ) VALUES (
         (SELECT id FROM provider.providers WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
         COALESCE($2, 0), COALESCE($3, 0), TRUE
       )
       RETURNING *`,
      [data.providerId, data.price || 0, data.discountPercentage || 0]
    );

    const psId = sRes.rows[0].id;
    if (data.subserviceIds && data.subserviceIds.length > 0) {
      for (const subId of data.subserviceIds) {
        await q.query(
          `INSERT INTO provider.provider_service_subservices (
             provider_service_id, subservice_id
           ) VALUES (
             $1, (SELECT id FROM catalog.subservices WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1)
           )
           ON CONFLICT DO NOTHING`,
          [psId, subId]
        );
      }
    }

    return {
      id: String(psId),
      provider_id: String(sRes.rows[0].provider_id),
      price: Number(sRes.rows[0].price),
      discount_percentage: Number(sRes.rows[0].discount_percentage),
      currency: sRes.rows[0].currency,
      is_active: Boolean(sRes.rows[0].is_active),
      subservice_ids: data.subserviceIds,
      created_at: new Date(sRes.rows[0].created_at),
      updated_at: new Date(sRes.rows[0].updated_at)
    };
  }

  static async removeService(serviceId: string, client?: PoolClient): Promise<boolean> {
    const q = client || this.pool;
    await q.query(`DELETE FROM provider.provider_service_subservices WHERE provider_service_id::text = $1`, [serviceId]);
    const res = await q.query(`DELETE FROM provider.provider_services WHERE id::text = $1`, [serviceId]);
    return (res.rowCount || 0) > 0;
  }
}
