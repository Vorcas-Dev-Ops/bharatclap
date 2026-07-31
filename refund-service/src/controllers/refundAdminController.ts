import { Request, Response } from 'express';
import { Refund } from '../models/Refund';
import { RefundPolicy } from '../models/RefundPolicy';
import { OutboxEvent } from '../models/OutboxEvent';

export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const totalRefundsToday = await Refund.countDocuments({ createdAt: { $gte: todayStart } });
    const pendingApproval = await Refund.countDocuments({ status: 'MANUAL_REVIEW' });
    const processing = await Refund.countDocuments({ status: { $in: ['PROCESSING', 'PENDING_GATEWAY'] } });
    const failed = await Refund.countDocuments({ status: 'FAILED' });
    const walletRefunds = await Refund.countDocuments({ refundType: 'FULL' });
    const gatewayRefunds = await Refund.countDocuments({ gatewayRefundId: { $ne: null } });

    const amountAgg = await Refund.aggregate([
      { $match: { status: 'COMPLETED', createdAt: { $gte: todayStart } } },
      { $group: { _id: null, total: { $sum: '$refundAmount' } } },
    ]);

    const amountRefundedToday = amountAgg[0]?.total || 0;

    res.json({
      totalRefundsToday,
      amountRefundedToday,
      pendingApproval,
      processing,
      failed,
      walletRefunds,
      gatewayRefunds,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err?.message });
  }
};

export const getPending = async (req: Request, res: Response): Promise<void> => {
  try {
    const items = await Refund.find({ status: { $in: ['MANUAL_REVIEW', 'REQUESTED'] } })
      .sort({ createdAt: -1 })
      .limit(50);

    const mapped = items.map(item => ({
      id: item._id.toString(),
      bookingId: item.bookingId.toString(),
      customer: item.customerId.toString(),
      provider: item.providerId ? item.providerId.toString() : 'N/A',
      amount: item.refundAmount,
      reason: item.reason,
      slaMinutesLeft: 45,
      requestedAt: item.requestedAt.toISOString(),
      status: item.status,
    }));

    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err?.message });
  }
};

export const getPolicies = async (req: Request, res: Response): Promise<void> => {
  try {
    let policies = await RefundPolicy.find();
    if (policies.length === 0) {
      policies = await RefundPolicy.create([
        { category: 'AC Repair', earlyCancellationHours: 2, refundPercentage: 100, providerCompensation: 200 },
        { category: 'Cleaning', earlyCancellationHours: 2, refundPercentage: 100, providerCompensation: 100 },
        { category: 'Plumbing', earlyCancellationHours: 2, refundPercentage: 100, providerCompensation: 150 },
      ]);
    }
    res.json(policies);
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err?.message });
  }
};

export const updatePolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, earlyCancellationHours, refundPercentage, providerCompensation } = req.body;
    const policy = await RefundPolicy.findOneAndUpdate(
      { category },
      { earlyCancellationHours, refundPercentage, providerCompensation },
      { new: true, upsert: true }
    );
    res.json(policy);
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err?.message });
  }
};

export const processAction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, note } = req.body;

    const newStatus = action === 'approve' ? 'APPROVED' : 'FAILED';
    const refund = await Refund.findByIdAndUpdate(id, { status: newStatus, metadata: { note } }, { new: true });

    if (!refund) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Refund record not found' });
      return;
    }

    await OutboxEvent.create({
      eventType: action === 'approve' ? 'REFUND_APPROVED' : 'REFUND_REJECTED',
      payload: { refundId: refund._id, note },
    });

    if (refund.providerId) {
      try {
        const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://127.0.0.1:5006';
        const PROVIDER_SERVICE_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
        const internalKey = process.env.INTERNAL_SERVICE_KEY || '2a6c1e55ff67db6dfde863d08f7fbdf9435b5463ff868bdcf0eb3d08c5c709e2';
        const importAxios = (await import('axios')).default;
        
        const provRes = await importAxios.post(`${PROVIDER_SERVICE_URL}/api/providers/batch`, { ids: [refund.providerId.toString()] }, {
          headers: { 'x-internal-service-key': internalKey }
        }).catch(() => null);

        const providerData = provRes?.data?.[0];
        const recipientId = providerData?.user_id?._id?.toString() || providerData?.user_id?.toString() || refund.providerId.toString();

        importAxios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
          recipient_id: recipientId,
          recipient_type: 'Provider',
          title: `Refund Update: ${action === 'approve' ? 'Approved' : 'Rejected'}`,
          message: `A refund request of ₹${refund.refundAmount} for a service booking has been ${action === 'approve' ? 'approved' : 'rejected'}.`,
          type: 'payment_alert',
          metadata: { refundId: refund._id, bookingId: refund.bookingId, amount: refund.refundAmount }
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
    const events = await OutboxEvent.find().sort({ createdAt: -1 }).limit(100);
    const logs = events.map(e => ({
      timestamp: e.createdAt.toISOString(),
      user: 'System Worker',
      action: `${e.eventType} - ${JSON.stringify(e.payload)}`,
      ip: '127.0.0.1',
    }));
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err?.message });
  }
};
