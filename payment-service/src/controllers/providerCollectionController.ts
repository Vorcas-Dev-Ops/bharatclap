import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ProviderCollection } from '../models/ProviderCollection';
import { CashRemittance } from '../models/CashRemittance';
import { sendSuccess, sendError, ErrorCodes } from '@bharatclap/shared';

// 1. Generate Booking Payment QR Payload
export const generateBookingQr = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookingId, providerId, customerId, upiId, displayName, amountBreakdown, idempotencyKey } = req.body;

    if (!bookingId || !providerId || !customerId || !upiId || !amountBreakdown || !amountBreakdown.amount) {
      sendError(res, 400, 'Missing required booking, provider, or amount details for QR generation', ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const key = idempotencyKey || `booking-${bookingId}-provider-payment-${Date.now()}`;

    // Check existing active collection for this booking to enforce 1 active collection constraint
    const existingActive = await ProviderCollection.findOne({
      booking_id: bookingId,
      status: { $in: ['INITIATED', 'AWAITING_CUSTOMER', 'CUSTOMER_CONFIRMED', 'PROVIDER_CONFIRMED'] },
    });

    if (existingActive) {
      // Check if existing QR is expired
      if (new Date() > new Date(existingActive.qr_expires_at)) {
        existingActive.status = 'EXPIRED';
        await existingActive.save();
      } else {
        // Return existing active collection
        sendSuccess(res, 200, 'Active QR collection payload retrieved', {
          collectionId: existingActive._id,
          bookingId: existingActive.booking_id,
          amount: existingActive.amount_snapshot.amount,
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

    const collectionId = new mongoose.Types.ObjectId();
    const qrReference = `BHCLAP-${bookingId}-${collectionId.toString().slice(-6).toUpperCase()}`;
    const amount = Number(amountBreakdown.amount);
    
    // Construct authoritative UPI URL: upi://pay?pa=...&pn=...&am=...&tr=...
    const encodedPn = encodeURIComponent(displayName || 'BharatClap Service');
    const qrPayload = `upi://pay?pa=${upiId}&pn=${encodedPn}&am=${amount.toFixed(2)}&tr=${qrReference}&cu=INR`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute expiry

    const collection = new ProviderCollection({
      _id: collectionId,
      booking_id: bookingId,
      provider_id: providerId,
      customer_id: customerId,
      method: 'PROVIDER_UPI',
      status: 'AWAITING_CUSTOMER',
      qr_reference: qrReference,
      qr_payload: qrPayload,
      qr_generated_at: new Date(),
      qr_expires_at: expiresAt,
      amount_snapshot: {
        amount,
        service_amount: Number(amountBreakdown.serviceAmount || amount),
        additional_charges: Number(amountBreakdown.additionalCharges || 0),
        tax: Number(amountBreakdown.tax || 0),
        discount: Number(amountBreakdown.discount || 0),
      },
      provider_upi_id: upiId,
      idempotency_key: key,
    });

    await collection.save();

    sendSuccess(res, 201, 'Booking payment QR payload generated successfully', {
      collectionId: collection._id,
      bookingId: collection.booking_id,
      amount: collection.amount_snapshot.amount,
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

    const collection = await ProviderCollection.findById(collectionId);
    if (!collection) {
      sendError(res, 404, 'Provider collection record not found', ErrorCodes.NOT_FOUND);
      return;
    }

    // Validate 15-minute expiration
    if (new Date() > new Date(collection.qr_expires_at)) {
      collection.status = 'EXPIRED';
      await collection.save();
      sendError(res, 400, 'Payment QR has expired. Please ask the provider to generate a new QR.', ErrorCodes.VALIDATION_ERROR);
      return;
    }

    collection.customer_transaction_reference = transactionReference?.trim() || undefined;
    collection.customer_confirmed_at = new Date();

    if (collection.status === 'PROVIDER_CONFIRMED') {
      collection.status = 'CONFIRMED_BY_BOTH';
    } else {
      collection.status = 'CUSTOMER_CONFIRMED';
    }

    await collection.save();

    sendSuccess(res, 200, 'Customer payment confirmation recorded', {
      collectionId: collection._id,
      bookingId: collection.booking_id,
      status: collection.status,
      customerConfirmedAt: collection.customer_confirmed_at,
      customerTransactionReference: collection.customer_transaction_reference,
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

    const collection = await ProviderCollection.findById(collectionId);
    if (!collection) {
      sendError(res, 404, 'Provider collection record not found', ErrorCodes.NOT_FOUND);
      return;
    }

    collection.provider_confirmed_at = new Date();

    if (collection.status === 'CUSTOMER_CONFIRMED') {
      collection.status = 'CONFIRMED_BY_BOTH';
    } else {
      collection.status = 'PROVIDER_CONFIRMED';
    }

    await collection.save();

    sendSuccess(res, 200, 'Provider payment confirmation recorded', {
      collectionId: collection._id,
      bookingId: collection.booking_id,
      status: collection.status,
      providerConfirmedAt: collection.provider_confirmed_at,
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed recording provider payment confirmation', ErrorCodes.INTERNAL_ERROR, { message: error?.message });
  }
};

// 4. Verify Payment (Automated / Admin verification)
export const verifyCollection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { collectionId, verifiedTransactionReference } = req.body;

    const collection = await ProviderCollection.findById(collectionId);
    if (!collection) {
      sendError(res, 404, 'Provider collection record not found', ErrorCodes.NOT_FOUND);
      return;
    }

    collection.status = 'VERIFIED';
    collection.verified_transaction_reference = verifiedTransactionReference || collection.customer_transaction_reference || `VER-${Date.now()}`;
    collection.verified_at = new Date();

    await collection.save();

    sendSuccess(res, 200, 'Payment verified successfully', {
      collectionId: collection._id,
      bookingId: collection.booking_id,
      status: collection.status,
      verifiedTransactionReference: collection.verified_transaction_reference,
      verifiedAt: collection.verified_at,
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed verifying payment collection', ErrorCodes.INTERNAL_ERROR, { message: error?.message });
  }
};

// 5. Emergency Cash Fallback Initiation
export const initiateCashFallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookingId, providerId, customerId, amountBreakdown, reason, reasonDetails } = req.body;

    if (!bookingId || !providerId || !customerId || !reason) {
      sendError(res, 400, 'Booking, provider, customer IDs and cash fallback reason are mandatory', ErrorCodes.VALIDATION_ERROR);
      return;
    }

    // Check if an existing UPI collection is already verified
    const existingVerified = await ProviderCollection.findOne({
      booking_id: bookingId,
      status: { $in: ['VERIFIED', 'CONFIRMED_BY_BOTH', 'CASH_CONFIRMED'] },
    });

    if (existingVerified) {
      sendError(res, 400, 'Payment for this booking has already been completed or confirmed.', ErrorCodes.VALIDATION_ERROR);
      return;
    }

    // Expire any pending active collections for this booking
    await ProviderCollection.updateMany(
      { booking_id: bookingId, status: { $in: ['INITIATED', 'AWAITING_CUSTOMER', 'CUSTOMER_CONFIRMED', 'PROVIDER_CONFIRMED'] } },
      { status: 'EXPIRED' }
    );

    const collectionId = new mongoose.Types.ObjectId();
    const qrReference = `BHCLAP-CASH-${bookingId}-${collectionId.toString().slice(-6).toUpperCase()}`;
    const amount = Number(amountBreakdown?.amount || 0);

    const collection = new ProviderCollection({
      _id: collectionId,
      booking_id: bookingId,
      provider_id: providerId,
      customer_id: customerId,
      method: 'PROVIDER_CASH',
      status: 'AWAITING_CUSTOMER',
      qr_reference: qrReference,
      qr_payload: 'CASH_FALLBACK',
      qr_generated_at: new Date(),
      qr_expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1-hour window for cash
      amount_snapshot: {
        amount,
        service_amount: Number(amountBreakdown?.serviceAmount || amount),
        additional_charges: Number(amountBreakdown?.additionalCharges || 0),
        tax: Number(amountBreakdown?.tax || 0),
        discount: Number(amountBreakdown?.discount || 0),
      },
      cash_reason: reason,
      cash_reason_details: reasonDetails || undefined,
      idempotency_key: `cash-fallback-${bookingId}-${Date.now()}`,
    });

    await collection.save();

    sendSuccess(res, 201, 'Emergency cash fallback requested', {
      collectionId: collection._id,
      bookingId: collection.booking_id,
      amount: collection.amount_snapshot.amount,
      method: collection.method,
      cashReason: collection.cash_reason,
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

    const collection = await ProviderCollection.findById(collectionId);
    if (!collection || collection.method !== 'PROVIDER_CASH') {
      sendError(res, 404, 'Provider cash collection record not found', ErrorCodes.NOT_FOUND);
      return;
    }

    collection.customer_confirmed_at = new Date();

    if (collection.status === 'PROVIDER_CONFIRMED' || collection.provider_confirmed_at) {
      collection.status = 'CASH_CONFIRMED';
    } else {
      collection.status = 'CUSTOMER_CONFIRMED';
    }

    await collection.save();

    // Create CashRemittance entry if dual confirmation complete
    if (collection.status === 'CASH_CONFIRMED') {
      await CashRemittance.findOneAndUpdate(
        { collection_id: collection._id },
        {
          booking_id: collection.booking_id,
          provider_id: collection.provider_id,
          amount: collection.amount_snapshot.amount,
          status: 'PENDING_REMITTANCE',
          collected_at: new Date(),
        },
        { upsert: true, new: true }
      );
    }

    sendSuccess(res, 200, 'Customer cash confirmation recorded', {
      collectionId: collection._id,
      bookingId: collection.booking_id,
      status: collection.status,
      customerConfirmedAt: collection.customer_confirmed_at,
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed recording customer cash confirmation', ErrorCodes.INTERNAL_ERROR, { message: error?.message });
  }
};

export const providerConfirmCash = async (req: Request, res: Response): Promise<void> => {
  try {
    const { collectionId } = req.body;

    const collection = await ProviderCollection.findById(collectionId);
    if (!collection || collection.method !== 'PROVIDER_CASH') {
      sendError(res, 404, 'Provider cash collection record not found', ErrorCodes.NOT_FOUND);
      return;
    }

    collection.provider_confirmed_at = new Date();

    if (collection.status === 'CUSTOMER_CONFIRMED' || collection.customer_confirmed_at) {
      collection.status = 'CASH_CONFIRMED';
    } else {
      collection.status = 'PROVIDER_CONFIRMED';
    }

    await collection.save();

    // Create CashRemittance entry if dual confirmation complete
    if (collection.status === 'CASH_CONFIRMED') {
      await CashRemittance.findOneAndUpdate(
        { collection_id: collection._id },
        {
          booking_id: collection.booking_id,
          provider_id: collection.provider_id,
          amount: collection.amount_snapshot.amount,
          status: 'PENDING_REMITTANCE',
          collected_at: new Date(),
        },
        { upsert: true, new: true }
      );
    }

    sendSuccess(res, 200, 'Provider cash confirmation recorded', {
      collectionId: collection._id,
      bookingId: collection.booking_id,
      status: collection.status,
      providerConfirmedAt: collection.provider_confirmed_at,
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

    const pending = await CashRemittance.find({
      provider_id: providerId,
      status: { $in: ['PENDING_REMITTANCE', 'REMITTED'] },
    }).sort({ createdAt: -1 });

    const totalPendingAmount = pending
      .filter((r) => r.status === 'PENDING_REMITTANCE')
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
    const { remittanceId, remittanceReference, proofReference } = req.body;

    const remittance = await CashRemittance.findById(remittanceId);
    if (!remittance) {
      sendError(res, 404, 'Cash remittance record not found', ErrorCodes.NOT_FOUND);
      return;
    }

    remittance.status = 'REMITTED';
    remittance.remittance_reference = remittanceReference || `REMIT-${Date.now()}`;
    remittance.proof_reference = proofReference || undefined;
    remittance.remitted_at = new Date();

    await remittance.save();

    sendSuccess(res, 200, 'Cash remittance submitted for admin reconciliation', {
      remittanceId: remittance._id,
      status: remittance.status,
      remittedAt: remittance.remitted_at,
      remittanceReference: remittance.remittance_reference,
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

    const query: any = { provider_id: providerId };
    if (method) query.method = method;
    if (status) query.status = status;

    const collections = await ProviderCollection.find(query).sort({ createdAt: -1 }).limit(50);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayCollections = collections.filter((c) => new Date(c.createdAt) >= todayStart);

    const upiTodayTotal = todayCollections
      .filter((c) => c.method === 'PROVIDER_UPI' && (c.status === 'CONFIRMED_BY_BOTH' || c.status === 'VERIFIED'))
      .reduce((sum, c) => sum + c.amount_snapshot.amount, 0);

    const cashTodayTotal = todayCollections
      .filter((c) => c.method === 'PROVIDER_CASH' && (c.status === 'CASH_CONFIRMED' || c.status === 'VERIFIED'))
      .reduce((sum, c) => sum + c.amount_snapshot.amount, 0);

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

    const collection = await ProviderCollection.findById(collectionId);
    if (!collection) {
      sendError(res, 404, 'Provider collection record not found', ErrorCodes.NOT_FOUND);
      return;
    }

    collection.status = 'DISPUTED';
    await collection.save();

    sendSuccess(res, 200, 'Payment dispute raised successfully', {
      collectionId: collection._id,
      bookingId: collection.booking_id,
      status: collection.status,
      reason,
      raisedBy: raisedBy || 'user',
    });
  } catch (error: any) {
    sendError(res, 500, 'Failed raising payment dispute', ErrorCodes.INTERNAL_ERROR, { message: error?.message });
  }
};
