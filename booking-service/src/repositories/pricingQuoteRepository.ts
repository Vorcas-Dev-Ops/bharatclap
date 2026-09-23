import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface PricingQuoteEntity {
  id: string;
  _id: string;
  quote_id: string;
  user_id: string;
  subservice_id?: string;
  variant_name?: string;
  pricing_breakdown: any;
  final_amount: number;
  final_total: number;
  subtotal: number;
  slot_charge: number;
  membership_discount: number;
  coupon_discount: number;
  tax_amount: number;
  pricingSnapshot: any;
  hmacSignature?: string;
  currency: string;
  expires_at: Date;
  status: string;
  created_at: Date;
}

export const mapPricingQuoteRow = (row: any): PricingQuoteEntity => {
  if (!row) return null as any;
  const breakdown = typeof row.pricing_breakdown === 'string'
    ? JSON.parse(row.pricing_breakdown)
    : (row.pricing_breakdown || {});

  const finalAmount = parseFloat(row.final_amount || breakdown.final_total || 0);

  return {
    id: String(row.id),
    _id: String(row.id),
    quote_id: row.quote_id,
    user_id: String(row.user_id),
    subservice_id: row.subservice_id ? String(row.subservice_id) : undefined,
    variant_name: row.variant_name || undefined,
    pricing_breakdown: breakdown,
    final_amount: finalAmount,
    final_total: finalAmount,
    subtotal: breakdown.subtotal || 0,
    slot_charge: breakdown.slot_charge || 0,
    membership_discount: breakdown.membership_discount || 0,
    coupon_discount: breakdown.coupon_discount || 0,
    tax_amount: breakdown.tax_amount || 0,
    pricingSnapshot: breakdown.pricingSnapshot || breakdown,
    hmacSignature: breakdown.hmacSignature,
    currency: row.currency || 'INR',
    expires_at: new Date(row.expires_at),
    status: breakdown.status || 'ACTIVE',
    created_at: new Date(row.created_at || Date.now()),
  };
};

export class PricingQuoteRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async findByQuoteId(quoteId: string): Promise<PricingQuoteEntity | null> {
    const res = await this.pool.query(
      `SELECT * FROM booking.pricing_quotes WHERE quote_id = $1 LIMIT 1`,
      [quoteId]
    );
    return res.rows[0] ? mapPricingQuoteRow(res.rows[0]) : null;
  }

  static async create(data: {
    quote_id: string;
    user_id: string;
    subservice_id?: string;
    items?: any[];
    subtotal?: number;
    slot_charge?: number;
    membership_discount?: number;
    coupon_discount?: number;
    tax_amount?: number;
    final_total?: number;
    pricingSnapshot?: any;
    hmacSignature?: string;
    status?: string;
    expires_at: Date;
  }): Promise<PricingQuoteEntity> {
    const subserviceId = data.subservice_id || (data.items && data.items[0]?.subserviceId) || null;
    const finalAmount = data.final_total || 0;

    const breakdown = {
      items: data.items || [],
      subtotal: data.subtotal || 0,
      slot_charge: data.slot_charge || 0,
      membership_discount: data.membership_discount || 0,
      coupon_discount: data.coupon_discount || 0,
      tax_amount: data.tax_amount || 0,
      final_total: finalAmount,
      pricingSnapshot: data.pricingSnapshot,
      hmacSignature: data.hmacSignature,
      status: data.status || 'ACTIVE',
    };

    const res = await this.pool.query(
      `INSERT INTO booking.pricing_quotes (
         quote_id, user_id, subservice_id, pricing_breakdown, final_amount, expires_at
       ) VALUES (
         $1,
         COALESCE(
           (SELECT id FROM auth.users WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1),
           '00000000-0000-0000-0000-000000000000'::uuid
         ),
         COALESCE(
           (SELECT id FROM catalog.subservices WHERE id::text = $3 OR legacy_mongo_id = $3 LIMIT 1),
           (SELECT id FROM catalog.subservices LIMIT 1)
         ),
         $4, $5, $6
       ) RETURNING *`,
      [
        data.quote_id,
        data.user_id,
        subserviceId,
        JSON.stringify(breakdown),
        finalAmount,
        data.expires_at,
      ]
    );

    return mapPricingQuoteRow(res.rows[0]);
  }
}
