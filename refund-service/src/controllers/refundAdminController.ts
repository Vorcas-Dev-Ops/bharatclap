import { Request, Response } from 'express';
import { getInternalServiceKey } from '@bharatclap/shared';
import { getDb } from '../config/db';
import { RefundRepository } from '../repositories/refundRepository';

export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const pool = getDb();
    const [countsRes, amountRes] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) AS total_today,
           COUNT(*) FILTER (WHERE status IN ('MANUAL_REVIEW', 'REQUESTED')) AS pending_approval,
           COUNT(*) FILTER (WHERE status IN ('PROCESSING', 'PENDING_GATEWAY')) AS processing,
           COUNT(*) FILTER (WHERE status = 'FAILED') AS failed,
           COUNT(*) FILTER (WHERE refund_type = 'full') AS wallet_refunds,
           COUNT(*) FILTER (WHERE gateway_refund_id IS NOT NULL) AS gateway_refunds
         FROM payment.refunds`
      ),
      pool.query(
        `SELECT COALESCE(SUM(refund_amount), 0) AS total
         FROM payment.refunds
         WHERE status = 'COMPLETED' AND created_at >= CURRENT_DATE`
      )
    ]);

    const counts = countsRes.rows[0];
    const amountRefundedToday = Number(amountRes.rows[0]?.total) || 0;

    res.json({
      totalRefundsToday: Number(counts.total_today) || 0,
      amountRefundedToday,
      pendingApproval: Number(counts.pending_approval) || 0,
      processing: Number(counts.processing) || 0,
      failed: Number(counts.failed) || 0,
      walletRefunds: Number(counts.wallet_refunds) || 0,
      gatewayRefunds: Number(counts.gateway_refunds) || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err?.message });
  }
};

export const getPending = async (req: Request, res: Response): Promise<void> => {
  try {
    const pool = getDb();
    const result = await pool.query(
      `SELECT * FROM payment.refunds
       WHERE status IN ('MANUAL_REVIEW', 'REQUESTED')
       ORDER BY created_at DESC
       LIMIT 50`
    );

    const mapped = result.rows.map(item => ({
      id: String(item.id),
      bookingId: String(item.booking_id),
      customer: String(item.customer_id),
      provider: item.provider_id ? String(item.provider_id) : 'N/A',
      amount: Number(item.refund_amount),
      reason: item.reason,
      slaMinutesLeft: 45,
      requestedAt: new Date(item.created_at).toISOString(),
      status: item.status,
    }));

    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err?.message });
  }
};

export const getPolicies = async (req: Request, res: Response): Promise<void> => {
  try {
    const pool = getDb();
    const result = await pool.query(`SELECT * FROM payment.refund_policies`);

    if (result.rowCount === 0) {
      const defaultPolicies = [
        { category: 'AC Repair', earlyCancellationHours: 2, refundPercentage: 100, providerCompensation: 200 },
        { category: 'Cleaning', earlyCancellationHours: 2, refundPercentage: 100, providerCompensation: 100 },
        { category: 'Plumbing', earlyCancellationHours: 2, refundPercentage: 100, providerCompensation: 150 },
      ];

      for (const p of defaultPolicies) {
        await pool.query(
          `INSERT INTO payment.refund_policies (rules) VALUES ($1)`,
          [JSON.stringify(p)]
        );
      }

      res.json(defaultPolicies);
      return;
    }

    res.json(result.rows.map(r => ({ id: r.id, ...(r.rules || {}) })));
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err?.message });
  }
};

export const updatePolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, earlyCancellationHours, refundPercentage, providerCompensation } = req.body;
    const rules = { category, earlyCancellationHours, refundPercentage, providerCompensation };
    const pool = getDb();

    const existing = await pool.query(
      `SELECT id FROM payment.refund_policies WHERE rules->>'category' = $1 LIMIT 1`,
      [category]
    );

    let result;
    if (existing.rowCount && existing.rowCount > 0) {
      result = await pool.query(
        `UPDATE payment.refund_policies SET rules = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [JSON.stringify(rules), existing.rows[0].id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO payment.refund_policies (rules) VALUES ($1) RETURNING *`,
        [JSON.stringify(rules)]
      );
    }

    res.json(result.rows[0]?.rules || rules);
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err?.message });
  }
};

export const processAction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, note } = req.body;

    const newStatus = action === 'approve' ? 'APPROVED' : 'FAILED';
    const refund = await RefundRepository.updateStatus(id, newStatus, { metadata: { note } });

    if (!refund) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Refund record not found' });
      return;
    }

    await RefundRepository.logOutboxEvent(
      action === 'approve' ? 'REFUND_APPROVED' : 'REFUND_REJECTED',
      { refundId: refund.id, note }
    );

    if (refund.providerId) {
      try {
        const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://127.0.0.1:5006';
        const PROVIDER_SERVICE_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
        const internalKey = getInternalServiceKey();
        const importAxios = (await import('axios')).default;
        
        const provRes = await importAxios.post(`${PROVIDER_SERVICE_URL}/api/providers/batch`, { ids: [refund.providerId] }, {
          headers: { 'x-internal-service-key': internalKey }
        }).catch(() => null);

        const providerData = provRes?.data?.[0];
        const recipientId = providerData?.user_id?._id?.toString() || providerData?.user_id?.toString() || refund.providerId;

        importAxios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
          recipient_id: recipientId,
          recipient_type: 'Provider',
          title: `Refund Update: ${action === 'approve' ? 'Approved' : 'Rejected'}`,
          message: `A refund request of ₹${refund.refundAmount} for a service booking has been ${action === 'approve' ? 'approved' : 'rejected'}.`,
          type: 'payment_alert',
          metadata: { refundId: refund.id, bookingId: refund.bookingId, amount: refund.refundAmount }
        }, {
          headers: { 'x-internal-service-key': internalKey }
        }).catch(err => console.error('[NOTIFICATION] Refund provider notification failed:', err.message));
      } catch (err: any) {
        console.error('[NOTIFICATION] Failed to send refund notification:', err.message);
      }
    }

    res.json({ success: true, refund });
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err?.message });
  }
};

export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const pool = getDb();
    const result = await pool.query(
      `SELECT * FROM payment.refund_outbox_events ORDER BY created_at DESC LIMIT 100`
    );

    const logs = result.rows.map(e => ({
      timestamp: new Date(e.created_at).toISOString(),
      user: 'System Worker',
      action: `${e.event_type} - ${JSON.stringify(e.payload)}`,
      ip: '127.0.0.1',
    }));
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err?.message });
  }
};
