import { Pool } from 'pg';
import { getDb } from '../config/db';

export class ReconciliationRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async getDailyReconciliation(): Promise<{
    totalTransactionsProcessed: number;
    totalRevenueCollected: number;
    journalBreakdown: any[];
  }> {
    const totalPaymentsRes = await this.pool.query(
      `SELECT COUNT(*)::int as count
       FROM payment.payments
       WHERE created_at >= CURRENT_DATE`
    );

    const successRes = await this.pool.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric as total
       FROM payment.payments
       WHERE payment_status = 'Captured' AND created_at >= CURRENT_DATE`
    );

    const journalRes = await this.pool.query(
      `SELECT
         reference_type as _id,
         COALESCE(SUM(jl.debit), 0)::numeric as total
       FROM accounting.journal_entries je
       JOIN accounting.journal_lines jl ON jl.journal_entry_id = je.id
       WHERE je.created_at >= CURRENT_DATE
       GROUP BY reference_type`
    );

    return {
      totalTransactionsProcessed: totalPaymentsRes.rows[0]?.count || 0,
      totalRevenueCollected: Number(successRes.rows[0]?.total || 0),
      journalBreakdown: journalRes.rows.map(r => ({
        _id: r._id,
        total: Number(r.total),
      })),
    };
  }

  static async getMonthlyClosing(): Promise<any[]> {
    const res = await this.pool.query(
      `SELECT
         COALESCE(payment_method, 'Online') as _id,
         COALESCE(SUM(amount), 0)::numeric as "totalAmount",
         COUNT(*)::int as count
       FROM payment.payments
       WHERE payment_status = 'Captured'
         AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
       GROUP BY payment_method`
    );

    return res.rows.map(r => ({
      _id: r._id,
      totalAmount: Number(r.totalAmount),
      count: Number(r.count),
    }));
  }

  static async getCodPayments(limit = 50): Promise<any[]> {
    const res = await this.pool.query(
      `SELECT * FROM payment.payments
       WHERE payment_method ILIKE '%cod%' OR payment_method ILIKE '%cash%'
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    return res.rows.map(r => ({
      _id: String(r.id),
      id: String(r.id),
      booking_id: String(r.booking_id),
      user_id: String(r.user_id),
      amount: Number(r.amount),
      paid_via: r.payment_method,
      payment_method: r.payment_method,
      payment_status: r.payment_status,
      created_at: r.created_at,
    }));
  }

  static async getFinanceExceptions(): Promise<{
    failedPayments: any[];
    orphanPayments: any[];
  }> {
    const failedRes = await this.pool.query(
      `SELECT id, amount, payment_status
       FROM payment.payments
       WHERE payment_status = 'Failed'
       ORDER BY created_at DESC
       LIMIT 20`
    );

    return {
      failedPayments: failedRes.rows.map(r => ({
        _id: String(r.id),
        amount: Number(r.amount),
        payment_status: r.payment_status,
      })),
      orphanPayments: [],
    };
  }
}
