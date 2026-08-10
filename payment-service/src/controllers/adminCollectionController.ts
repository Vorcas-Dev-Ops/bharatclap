import { Request, Response } from 'express';
import { ProviderCollection } from '../models/ProviderCollection';
import { CashRemittance } from '../models/CashRemittance';
import { sendSuccess, sendError, ErrorCodes } from '@bharatclap/shared';

// 1. Admin Collections Table Endpoint
export const getAdminProviderCollections = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20, method, status, search } = req.query;

    const query: any = {};
    if (method) query.method = method;
    if (status) query.status = status;
    if (search) {
      const searchStr = String(search).trim();
      query.$or = [
        { qr_reference: { $regex: searchStr, $options: 'i' } },
        { customer_transaction_reference: { $regex: searchStr, $options: 'i' } },
        { verified_transaction_reference: { $regex: searchStr, $options: 'i' } },
        { provider_upi_id: { $regex: searchStr, $options: 'i' } },
      ];
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const collections = await ProviderCollection.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await ProviderCollection.countDocuments(query);

    sendSuccess(res, 200, 'Admin provider collections retrieved', {
      collections,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed fetching admin provider collections', ErrorCodes.INTERNAL_ERROR, { message: error?.message });
  }
};

// 2. Admin Finance Dashboard Metrics Endpoint
export const getAdminCollectionMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const collections = await ProviderCollection.find({
      status: { $in: ['CONFIRMED_BY_BOTH', 'CASH_CONFIRMED', 'VERIFIED'] },
    });

    const upiCollectionsTotal = collections
      .filter((c) => c.method === 'PROVIDER_UPI')
      .reduce((sum, c) => sum + c.amount_snapshot.amount, 0);

    const cashCollectionsTotal = collections
      .filter((c) => c.method === 'PROVIDER_CASH')
      .reduce((sum, c) => sum + c.amount_snapshot.amount, 0);

    const totalCollections = upiCollectionsTotal + cashCollectionsTotal;
    const cashFallbackPercent = collections.length > 0
      ? Number(((collections.filter((c) => c.method === 'PROVIDER_CASH').length / collections.length) * 100).toFixed(2))
      : 0;

    const pendingConfirmationsCount = await ProviderCollection.countDocuments({
      status: { $in: ['CUSTOMER_CONFIRMED', 'PROVIDER_CONFIRMED'] },
    });

    const disputesCount = await ProviderCollection.countDocuments({
      status: { $in: ['DISPUTED', 'UNDER_REVIEW'] },
    });

    const remittances = await CashRemittance.find();

    const pendingRemittanceTotal = remittances
      .filter((r) => r.status === 'PENDING_REMITTANCE')
      .reduce((sum, r) => sum + r.amount, 0);

    const remittedTotal = remittances
      .filter((r) => r.status === 'REMITTED')
      .reduce((sum, r) => sum + r.amount, 0);

    const reconciledTotal = remittances
      .filter((r) => r.status === 'RECONCILED')
      .reduce((sum, r) => sum + r.amount, 0);

    sendSuccess(res, 200, 'Admin collection metrics retrieved', {
      metrics: {
        totalProviderCollections: totalCollections,
        providerUpiCollections: upiCollectionsTotal,
        providerCashCollections: cashCollectionsTotal,
        cashFallbackPercent,
        pendingConfirmationsCount,
        disputesCount,
        cashPendingRemittance: pendingRemittanceTotal,
        cashRemitted: remittedTotal,
        cashReconciled: reconciledTotal,
      },
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed fetching admin collection metrics', ErrorCodes.INTERNAL_ERROR, { message: error?.message });
  }
};

// 3. Admin Cash Remittance Reconciliation
export const reconcileCashRemittance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { remittanceId, adminUserId } = req.body;

    const remittance = await CashRemittance.findById(remittanceId);
    if (!remittance) {
      sendError(res, 404, 'Cash remittance record not found', ErrorCodes.NOT_FOUND);
      return;
    }

    remittance.status = 'RECONCILED';
    remittance.reconciled_at = new Date();
    if (adminUserId) remittance.reconciled_by = adminUserId;

    await remittance.save();

    sendSuccess(res, 200, 'Cash remittance reconciled successfully', {
      remittanceId: remittance._id,
      status: remittance.status,
      reconciledAt: remittance.reconciled_at,
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed reconciling cash remittance', ErrorCodes.INTERNAL_ERROR, { message: error?.message });
  }
};

// 4. Admin Payment Dispute Resolution
export const resolvePaymentDispute = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { resolution, adminUserId, remarks } = req.body;

    if (!resolution || !['RESOLVED_CUSTOMER', 'RESOLVED_PROVIDER'].includes(resolution)) {
      sendError(res, 400, 'Valid resolution outcome (RESOLVED_CUSTOMER or RESOLVED_PROVIDER) is required', ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const collection = await ProviderCollection.findById(id);
    if (!collection) {
      sendError(res, 404, 'Provider collection record not found', ErrorCodes.NOT_FOUND);
      return;
    }

    collection.status = resolution as any;
    await collection.save();

    sendSuccess(res, 200, `Dispute resolved in favor of ${resolution === 'RESOLVED_CUSTOMER' ? 'Customer' : 'Provider'}`, {
      collectionId: collection._id,
      bookingId: collection.booking_id,
      status: collection.status,
      resolvedBy: adminUserId || 'admin',
      remarks,
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed resolving payment dispute', ErrorCodes.INTERNAL_ERROR, { message: error?.message });
  }
};
