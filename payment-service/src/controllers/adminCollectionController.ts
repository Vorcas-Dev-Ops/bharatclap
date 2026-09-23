import { Request, Response } from 'express';
import { CollectionRepository } from '../repositories/collectionRepository';
import { sendSuccess, sendError, ErrorCodes } from '@bharatclap/shared';

// 1. Admin Collections Table Endpoint
export const getAdminProviderCollections = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20, method, status, search } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);

    const { collections, total } = await CollectionRepository.findCollections({
      method: method as string,
      status: status as string,
      search: search as string,
      page: pageNum,
      limit: limitNum,
    });

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
    const { collections } = await CollectionRepository.findCollections({ limit: 1000 });

    const confirmed = collections.filter((c) =>
      ['CONFIRMED_BY_BOTH', 'CASH_CONFIRMED', 'VERIFIED'].includes(c.status)
    );

    const upiCollectionsTotal = confirmed
      .filter((c) => c.method === 'PROVIDER_UPI')
      .reduce((sum, c) => sum + (c.amount_snapshot?.amount || c.amount), 0);

    const cashCollectionsTotal = confirmed
      .filter((c) => c.method === 'PROVIDER_CASH')
      .reduce((sum, c) => sum + (c.amount_snapshot?.amount || c.amount), 0);

    const totalCollections = upiCollectionsTotal + cashCollectionsTotal;
    const cashFallbackPercent = collections.length > 0
      ? Number(((collections.filter((c) => c.method === 'PROVIDER_CASH').length / collections.length) * 100).toFixed(2))
      : 0;

    const pendingConfirmationsCount = collections.filter((c) =>
      ['CUSTOMER_CONFIRMED', 'PROVIDER_CONFIRMED'].includes(c.status)
    ).length;

    const disputesCount = collections.filter((c) =>
      ['DISPUTED', 'UNDER_REVIEW'].includes(c.status)
    ).length;

    const remittances = await CollectionRepository.findRemittances();

    const pendingRemittanceTotal = remittances
      .filter((r) => r.status === 'pending' || r.status === 'PENDING_REMITTANCE')
      .reduce((sum, r) => sum + r.amount, 0);

    const remittedTotal = remittances
      .filter((r) => r.status === 'collected' || r.status === 'REMITTED')
      .reduce((sum, r) => sum + r.amount, 0);

    const reconciledTotal = remittances
      .filter((r) => r.status === 'verified' || r.status === 'RECONCILED')
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
    const { remittanceId } = req.body;

    const remittance = await CollectionRepository.updateRemittance(remittanceId, 'verified');
    if (!remittance) {
      sendError(res, 404, 'Cash remittance record not found', ErrorCodes.NOT_FOUND);
      return;
    }

    sendSuccess(res, 200, 'Cash remittance reconciled successfully', {
      remittanceId: remittance._id,
      status: remittance.status,
      reconciledAt: new Date(),
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

    const collection = await CollectionRepository.findById(id);
    if (!collection) {
      sendError(res, 404, 'Provider collection record not found', ErrorCodes.NOT_FOUND);
      return;
    }

    const updated = await CollectionRepository.updateCollection(collection.id, {
      status: resolution,
    });

    sendSuccess(res, 200, `Dispute resolved in favor of ${resolution === 'RESOLVED_CUSTOMER' ? 'Customer' : 'Provider'}`, {
      collectionId: updated?._id || collection._id,
      bookingId: updated?.booking_id || collection.booking_id,
      status: resolution,
      resolvedBy: adminUserId || 'admin',
      remarks,
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed resolving payment dispute', ErrorCodes.INTERNAL_ERROR, { message: error?.message });
  }
};
