import { Request, Response } from 'express';
import { CollectionRepository } from '../repositories/collectionRepository';
import { sendSuccess, sendError, ErrorCodes, Money } from '@bharatclap/shared';

// 1. Generate Booking Payment QR Payload
export const generateBookingQr = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookingId, providerId, customerId, upiId, displayName, amountBreakdown, idempotencyKey } = req.body;

    const bId = (typeof bookingId === 'object' && bookingId !== null) ? String(bookingId._id || bookingId.id || bookingId) : String(bookingId || '');
    const pId = (typeof providerId === 'object' && providerId !== null) ? String(providerId._id || providerId.id || providerId) : String(providerId || '');
    const cId = (typeof customerId === 'object' && customerId !== null) ? String(customerId._id || customerId.id || customerId) : String(customerId || '');
    const upi = String(upiId || 'bharatclap.partner@upi');
    const amt = Money.from(amountBreakdown?.amount || amountBreakdown || req.body.amount || 0).toNumber();

    if (!bId || !amt) {
      sendError(res, 400, 'Missing required booking or amount details for QR generation', ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const key = idempotencyKey || `booking-${bId}-provider-payment-${Date.now()}`;

    // Check existing active collection for this booking
    const existingActive = await CollectionRepository.findActiveByBookingId(bId);

    if (existingActive) {
      if (existingActive.qr_expires_at && new Date() > new Date(existingActive.qr_expires_at)) {
        await CollectionRepository.updateCollection(existingActive.id, { status: 'EXPIRED' });
      } else {
        sendSuccess(res, 200, 'Active QR collection payload retrieved', {
          collectionId: existingActive._id,
          bookingId: existingActive.booking_id,
          amount: existingActive.amount_snapshot?.amount || existingActive.amount,
          amountBreakdown: existingActive.amount_snapshot,
          method: existingActive.method,
          upiId: existingActive.provider_upi_id,
          displayName,
          qrReference: existingActive.qr_reference,
          qrPayload: existingActive.qr_payload,
          expiresAt: existingActive.qr_expires_at,
          status: existingActive.status,
        });
        return;
      }
    }

    const qrReference = `BHCLAP-${bId}-${Date.now().toString().slice(-6).toUpperCase()}`;
    const amount = amt;

    const encodedPn = encodeURIComponent(displayName || 'BharatClap Service');
    const qrPayload = `upi://pay?pa=${upi}&pn=${encodedPn}&am=${Money.from(amount).toPg()}&tr=${qrReference}&cu=INR`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const amountSnapshot = {
      amount,
      service_amount: Money.from(amountBreakdown?.serviceAmount || amount).toNumber(),
      additional_charges: Money.from(amountBreakdown?.additionalCharges || 0).toNumber(),
      tax: Money.from(amountBreakdown?.tax || 0).toNumber(),
      discount: Money.from(amountBreakdown?.discount || 0).toNumber(),
    };

    const collection = await CollectionRepository.createCollection({
      bookingId: bId,
      providerId: pId || 'provider',
      customerId: cId || 'customer',
      method: 'PROVIDER_UPI',
      status: 'AWAITING_CUSTOMER',
      amount,
      amountSnapshot,
      qrReference,
      qrPayload,
      qrExpiresAt: expiresAt,
      providerUpiId: upiId,
      idempotencyKey: key,
    });

    sendSuccess(res, 201, 'Booking payment QR payload generated successfully', {
      collectionId: collection._id,
      bookingId: collection.booking_id,
      amount: collection.amount_snapshot?.amount || collection.amount,
      amountBreakdown: collection.amount_snapshot,
      method: collection.method,
      upiId: collection.provider_upi_id,
      displayName: displayName || 'BharatClap Partner',
      qrReference: collection.qr_reference,
      qrPayload: collection.qr_payload,
      expiresAt: collection.qr_expires_at,
      status: collection.status,
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed generating booking QR payload', ErrorCodes.INTERNAL_ERROR, { message: error?.message });
  }
};

// 2. Customer Confirms UPI Payment
export const customerConfirmUpi = async (req: Request, res: Response): Promise<void> => {
  try {
    const { collectionId, transactionReference } = req.body;

    if (!collectionId) {
      sendError(res, 400, 'Collection ID is required', ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const collection = await CollectionRepository.findById(collectionId);
    if (!collection) {
      sendError(res, 404, 'Provider collection record not found', ErrorCodes.NOT_FOUND);
      return;
    }

    if (collection.qr_expires_at && new Date() > new Date(collection.qr_expires_at)) {
      await CollectionRepository.updateCollection(collection.id, { status: 'EXPIRED' });
      sendError(res, 400, 'Payment QR has expired. Please ask the provider to generate a new QR.', ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const nextStatus = collection.status === 'PROVIDER_CONFIRMED' ? 'CONFIRMED_BY_BOTH' : 'CUSTOMER_CONFIRMED';
    const updated = await CollectionRepository.updateCollection(collection.id, {
      status: nextStatus,
      customerTxnRef: transactionReference?.trim() || undefined,
    });

    sendSuccess(res, 200, 'Customer payment confirmation recorded', {
      collectionId: updated?._id || collection._id,
      bookingId: updated?.booking_id || collection.booking_id,
      status: updated?.status || nextStatus,
      customerConfirmedAt: new Date(),
      customerTransactionReference: transactionReference,
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed recording customer payment confirmation', ErrorCodes.INTERNAL_ERROR, { message: error?.message });
  }
};

// 3. Provider Confirms Receipt of UPI Payment
export const providerConfirmUpi = async (req: Request, res: Response): Promise<void> => {
  try {
    const { collectionId } = req.body;

    if (!collectionId) {
      sendError(res, 400, 'Collection ID is required', ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const collection = await CollectionRepository.findById(collectionId);
    if (!collection) {
      sendError(res, 404, 'Provider collection record not found', ErrorCodes.NOT_FOUND);
      return;
    }

    const nextStatus = collection.status === 'CUSTOMER_CONFIRMED' ? 'CONFIRMED_BY_BOTH' : 'PROVIDER_CONFIRMED';
    const updated = await CollectionRepository.updateCollection(collection.id, { status: nextStatus });

    sendSuccess(res, 200, 'Provider payment confirmation recorded', {
      collectionId: updated?._id || collection._id,
      bookingId: updated?.booking_id || collection.booking_id,
      status: updated?.status || nextStatus,
      providerConfirmedAt: new Date(),
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed recording provider payment confirmation', ErrorCodes.INTERNAL_ERROR, { message: error?.message });
  }
};

// 4. Verify Payment (Automated / Admin verification)
export const verifyCollection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { collectionId, verifiedTransactionReference } = req.body;

    const collection = await CollectionRepository.findById(collectionId);
    if (!collection) {
      sendError(res, 404, 'Provider collection record not found', ErrorCodes.NOT_FOUND);
      return;
    }

    const ref = verifiedTransactionReference || collection.customer_transaction_reference || `VER-${Date.now()}`;
    const updated = await CollectionRepository.updateCollection(collection.id, {
      status: 'VERIFIED',
      verifiedTxnRef: ref,
    });

    sendSuccess(res, 200, 'Payment verified successfully', {
      collectionId: updated?._id || collection._id,
      bookingId: updated?.booking_id || collection.booking_id,
      status: 'VERIFIED',
      verifiedTransactionReference: ref,
      verifiedAt: new Date(),
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed verifying payment collection', ErrorCodes.INTERNAL_ERROR, { message: error?.message });
  }
};

// 5. Emergency Cash Fallback Initiation
export const initiateCashFallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookingId, providerId, customerId, amountBreakdown, reason, reasonDetails } = req.body;

    const bId = (typeof bookingId === 'object' && bookingId !== null) ? String(bookingId._id || bookingId.id || bookingId) : String(bookingId || '');
    const pId = (typeof providerId === 'object' && providerId !== null) ? String(providerId._id || providerId.id || providerId) : String(providerId || '');
    const cId = (typeof customerId === 'object' && customerId !== null) ? String(customerId._id || customerId.id || customerId) : String(customerId || '');

    if (!bId) {
      sendError(res, 400, 'Booking ID is mandatory for cash collection', ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const existingActive = await CollectionRepository.findActiveByBookingId(bId);
    if (existingActive && ['VERIFIED', 'CONFIRMED_BY_BOTH', 'CASH_CONFIRMED'].includes(existingActive.status)) {
      sendError(res, 400, 'Payment for this booking has already been completed or confirmed.', ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const qrReference = `BHCLAP-CASH-${bId}-${Date.now().toString().slice(-6).toUpperCase()}`;
    const amount = Money.from(amountBreakdown?.amount || req.body.amount || 0).toNumber();

    const amountSnapshot = {
      amount,
      service_amount: Money.from(amountBreakdown?.serviceAmount || amount).toNumber(),
      additional_charges: Money.from(amountBreakdown?.additionalCharges || 0).toNumber(),
      tax: Money.from(amountBreakdown?.tax || 0).toNumber(),
      discount: Money.from(amountBreakdown?.discount || 0).toNumber(),
    };

    const collection = await CollectionRepository.createCollection({
      bookingId: bId,
      providerId: pId || 'provider',
      customerId: cId || 'customer',
      method: 'PROVIDER_CASH',
      status: 'AWAITING_CUSTOMER',
      amount,
      amountSnapshot,
      qrReference,
      qrPayload: 'CASH_FALLBACK',
      qrExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      idempotencyKey: `cash-fallback-${bId}-${Date.now()}`,
    });

    sendSuccess(res, 201, 'Emergency cash fallback requested', {
      collectionId: collection._id,
      bookingId: collection.booking_id,
      amount: collection.amount,
      method: collection.method,
      cashReason: reason,
      status: collection.status,
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed initiating emergency cash fallback', ErrorCodes.INTERNAL_ERROR, { message: error?.message });
  }
};

// 6. Dual Confirmation for Cash Collection
export const customerConfirmCash = async (req: Request, res: Response): Promise<void> => {
  try {
    const { collectionId } = req.body;

    const collection = await CollectionRepository.findById(collectionId);
    if (!collection || collection.method !== 'PROVIDER_CASH') {
      sendError(res, 404, 'Provider cash collection record not found', ErrorCodes.NOT_FOUND);
      return;
    }

    const nextStatus = collection.status === 'PROVIDER_CONFIRMED' ? 'CASH_CONFIRMED' : 'CUSTOMER_CONFIRMED';
    const updated = await CollectionRepository.updateCollection(collection.id, { status: nextStatus });

    if (nextStatus === 'CASH_CONFIRMED') {
      await CollectionRepository.createRemittance({
        providerId: collection.provider_id,
        amount: collection.amount,
        status: 'pending',
      });
    }

    sendSuccess(res, 200, 'Customer cash confirmation recorded', {
      collectionId: updated?._id || collection._id,
      bookingId: updated?.booking_id || collection.booking_id,
      status: updated?.status || nextStatus,
      customerConfirmedAt: new Date(),
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed recording customer cash confirmation', ErrorCodes.INTERNAL_ERROR, { message: error?.message });
  }
};

export const providerConfirmCash = async (req: Request, res: Response): Promise<void> => {
  try {
    const { collectionId } = req.body;

    const collection = await CollectionRepository.findById(collectionId);
    if (!collection || collection.method !== 'PROVIDER_CASH') {
      sendError(res, 404, 'Provider cash collection record not found', ErrorCodes.NOT_FOUND);
      return;
    }

    const nextStatus = collection.status === 'CUSTOMER_CONFIRMED' ? 'CASH_CONFIRMED' : 'PROVIDER_CONFIRMED';
    const updated = await CollectionRepository.updateCollection(collection.id, { status: nextStatus });

    if (nextStatus === 'CASH_CONFIRMED') {
      await CollectionRepository.createRemittance({
        providerId: collection.provider_id,
        amount: collection.amount,
        status: 'pending',
      });
    }

    sendSuccess(res, 200, 'Provider cash confirmation recorded', {
      collectionId: updated?._id || collection._id,
      bookingId: updated?.booking_id || collection.booking_id,
      status: updated?.status || nextStatus,
      providerConfirmedAt: new Date(),
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed recording provider cash confirmation', ErrorCodes.INTERNAL_ERROR, { message: error?.message });
  }
};

// 7. Get Provider Pending Cash Remittances
export const getProviderPendingRemittances = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.query;

    if (!providerId) {
      sendError(res, 400, 'Provider ID is required', ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const pending = await CollectionRepository.findRemittances(String(providerId));
    const totalPendingAmount = pending
      .filter((r) => r.status === 'pending' || r.status === 'PENDING_REMITTANCE')
      .reduce((sum, r) => sum + r.amount, 0);

    sendSuccess(res, 200, 'Pending cash remittances retrieved', {
      pendingRemittances: pending,
      totalPendingAmount,
      count: pending.length,
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed fetching pending remittances', ErrorCodes.INTERNAL_ERROR, { message: error?.message });
  }
};

// 8. Submit Provider Cash Remittance
export const submitCashRemittance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { remittanceId } = req.body;

    const remittance = await CollectionRepository.updateRemittance(remittanceId, 'collected');
    if (!remittance) {
      sendError(res, 404, 'Cash remittance record not found', ErrorCodes.NOT_FOUND);
      return;
    }

    sendSuccess(res, 200, 'Cash remittance submitted for admin reconciliation', {
      remittanceId: remittance._id,
      status: remittance.status,
      remittedAt: new Date(),
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed submitting cash remittance', ErrorCodes.INTERNAL_ERROR, { message: error?.message });
  }
};

// 9. Provider Collection History
export const getProviderCollectionHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId, method, status } = req.query;

    if (!providerId) {
      sendError(res, 400, 'Provider ID is required', ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const { collections } = await CollectionRepository.findCollections({
      providerId: String(providerId),
      method: method as string,
      status: status as string,
      limit: 50,
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayCollections = collections.filter((c) => new Date(c.createdAt) >= todayStart);

    const upiTodayTotal = todayCollections
      .filter((c) => c.method === 'PROVIDER_UPI' && (c.status === 'CONFIRMED_BY_BOTH' || c.status === 'VERIFIED'))
      .reduce((sum, c) => sum + (c.amount_snapshot?.amount || c.amount), 0);

    const cashTodayTotal = todayCollections
      .filter((c) => c.method === 'PROVIDER_CASH' && (c.status === 'CASH_CONFIRMED' || c.status === 'VERIFIED'))
      .reduce((sum, c) => sum + (c.amount_snapshot?.amount || c.amount), 0);

    sendSuccess(res, 200, 'Provider collection history retrieved', {
      collections,
      todaySummary: {
        upiTotal: upiTodayTotal,
        cashTotal: cashTodayTotal,
        grandTotal: upiTodayTotal + cashTodayTotal,
      },
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed fetching collection history', ErrorCodes.INTERNAL_ERROR, { message: error?.message });
  }
};

// 10. Raise Payment Dispute
export const raisePaymentDispute = async (req: Request, res: Response): Promise<void> => {
  try {
    const { collectionId, reason, raisedBy } = req.body;

    const collection = await CollectionRepository.findById(collectionId);
    if (!collection) {
      sendError(res, 404, 'Provider collection record not found', ErrorCodes.NOT_FOUND);
      return;
    }

    const updated = await CollectionRepository.updateCollection(collection.id, {
      status: 'DISPUTED',
      dispute: { reason, raisedBy, raisedAt: new Date().toISOString() },
    });

    sendSuccess(res, 200, 'Payment dispute raised successfully', {
      collectionId: updated?._id || collection._id,
      bookingId: updated?.booking_id || collection.booking_id,
      status: 'DISPUTED',
      reason,
      raisedBy: raisedBy || 'user',
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed raising payment dispute', ErrorCodes.INTERNAL_ERROR, { message: error?.message });
  }
};
