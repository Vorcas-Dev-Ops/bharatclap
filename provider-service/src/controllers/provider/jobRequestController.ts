import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Provider } from '../../models/Provider';
import { JobRequest } from '../../models/JobRequest';
import { WalletTransaction } from '../../models/WalletTransaction';
import { LeadFeeConfig } from '../../models/LeadFeeConfig';
import { LeadPackageOrder } from '../../models/LeadPackageOrder';
import { LeadTransaction } from '../../models/LeadTransaction';
import { emitToUser, redisClient, isRedisAvailable } from '../../services/socketService';
import { getUsersBatch, getCatalogBatch, getAddressesBatch, getBookingsBatch } from '../../utils/internalApi';
import axios from 'axios';
import mongoose from 'mongoose';

// @desc    Get pending job requests for current provider
// @route   GET /api/providers/job-requests
// @access  Private/Provider
export const getMyJobRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const isFreeAccess = provider.isFreeAccessEnabled || provider.subscriptionStatus === 'active' || provider.subscriptionStatus === 'grace_period';

    // If not fully approved/verified, starter kit not purchased (and no free access), or wallet blocked, return empty list gracefully
    if (provider.kyc_status !== 'verified' || provider.isWalletBlocked) {
      res.json([]);
      return;
    }

    if (!isFreeAccess && (!provider.kitPurchased || provider.availableCredit < 0)) {
      res.json([]);
      return;
    }

    // Only return pending requests that haven't expired yet
    const requests = await JobRequest.find({
      provider_id: provider._id,
      status: 'pending',
      expires_at: { $gt: new Date() }
    }).sort({ createdAt: -1 }).lean();

    const bookingIds = [...new Set(requests.map(r => r.booking_id?.toString()).filter(Boolean))];
    const bookings = await getBookingsBatch(bookingIds);
    const bookingMap = new Map(bookings.map((b: any) => [String(b._id), b]));

    const userIds = [...new Set(bookings.map((b: any) => b.user_id?.toString()).filter(Boolean))];
    const subserviceIds = [...new Set(bookings.map((b: any) => b.subservice_id?.toString()).filter(Boolean))];
    const addressIds = [...new Set(bookings.map((b: any) => b.address_id?.toString()).filter(Boolean))];
    
    const [users, catalogData, addresses] = await Promise.all([
      getUsersBatch(userIds),
      getCatalogBatch(subserviceIds, [], [], []),
      getAddressesBatch(addressIds)
    ]);

    const userMap = new Map<string, any>(users.map((u: any) => [String(u._id), u]));
    const subserviceMap = new Map<string, any>(catalogData.subservices.map((s: any) => [String(s._id), s]));
    const addressMap = new Map<string, any>(addresses.map((a: any) => [String(a._id), a]));

    const mappedRequests = requests.map(r => {
      const booking = bookingMap.get(String(r.booking_id)) as any;
      if (!booking) return null;

      const user = userMap.get(String(booking.user_id));
      const subservice = subserviceMap.get(String(booking.subservice_id));
      const address = addressMap.get(String(booking.address_id));

      const serviceName = subservice?.subservice_name || subservice?.service_id?.service_name || 'New Service Request';

      return {
        _id: r._id,
        request_id: r._id,
        booking_id: {
          _id: booking._id,
          booking_id: booking.booking_id,
          user_id: user ?? booking.user_id,
          address_id: address ?? booking.address_id
        },
        display_id: booking.booking_id,
        service_name: serviceName,
        amount: booking.payable_amount,
        location: {
          address: address?.address_line || 'Address',
          city: address?.city || 'City',
          distance: r.distance ? (r.distance / 1000).toFixed(1) + ' km' : 'Nearby'
        },
        scheduled_at: booking.scheduled_at,
        booking_time: booking.booking_time,
        expires_at: r.expires_at,
        status: r.status
      };
    }).filter(Boolean);

    res.json(mappedRequests);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Accept a job request
// @route   POST /api/providers/job-requests/:id/accept
// @access  Private/Provider
export const acceptJobRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  let lockKey = '';
  let isLockedByUs = false;
  try {
    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const request = await JobRequest.findById(req.params.id);
    if (!request) {
      res.status(404).json({ message: 'Request not found' });
      return;
    }

    // Idempotency: already accepted by this provider — return gracefully
    if (request.status === 'accepted' && String(request.provider_id) === String(provider._id)) {
      const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
      try {
        const bRes = await axios.get(`${BOOKING_URL}/api/bookings/${request.booking_id}`, {
          headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
        });
        res.json({ message: 'Job already accepted', booking: bRes.data });
      } catch {
        res.json({ message: 'Job already accepted' });
      }
      return;
    }

    if (request.status !== 'pending') {
      res.status(400).json({ message: 'Request is no longer valid or has already been processed' });
      return;
    }

    // Short-lived accept lock to prevent duplicate concurrent clicks
    if (isRedisAvailable && redisClient) {
      lockKey = `accept:${request.booking_id}:${provider._id}`;
      const acquired = await redisClient.set(lockKey, 'locked', 'EX', 15, 'NX');
      if (acquired !== 'OK') {
        res.status(429).json({ message: 'Request is already being processed. Please wait.' });
        return;
      }
      isLockedByUs = true;
    }

    if (request.expires_at && new Date() > new Date(request.expires_at)) {
      request.status = 'expired';
      await request.save();

      // Release hold
      const holdTx = await WalletTransaction.findOne({
        provider_id: provider._id,
        type: 'hold',
        referenceId: String(request.booking_id)
      });
      if (holdTx) {
        const releaseTx = await WalletTransaction.findOne({
          type: 'release',
          referenceId: String(request.booking_id)
        });
        if (!releaseTx) {
          provider.reservedBalance = Math.max(0, provider.reservedBalance - holdTx.amount);
          await provider.save();

          await WalletTransaction.create({
            provider_id: provider._id,
            type: 'release',
            amount: holdTx.amount,
            balanceAfter: provider.walletBalance - provider.reservedBalance,
            referenceId: String(request.booking_id),
            description: `Release hold for booking dispatch timeout #${request.booking_id}`,
            status: 'success'
          });
        }
      }

      res.status(400).json({ message: 'Request has expired' });
      return;
    }

    // Enforce credit check BEFORE making the cross-service call to prevent inconsistent states
    const preCheckHold = await WalletTransaction.findOne({
      provider_id: provider._id,
      type: 'hold',
      referenceId: String(request.booking_id)
    });
    const isFreeAccessActive = (p: any) => {
      if (!p.isFreeAccessEnabled) return false;
      const now = new Date();
      if (p.freeAccessEndDate && new Date(p.freeAccessEndDate) < now) {
        if (p.gracePeriodEndDate && new Date(p.gracePeriodEndDate) >= now) {
          return true;
        }
        return false;
      }
      return true;
    };

    const expectedFee = preCheckHold ? preCheckHold.amount : 100;
    const creditToCheck = preCheckHold ? provider.availableCredit : (provider.availableCredit - expectedFee);
    if (!isFreeAccessActive(provider) && creditToCheck < 0) {
      res.status(403).json({ 
        message: `Deduction rejected: transaction would exceed the -₹${provider.creditLimit || 500} credit limit.` 
      });
      return;
    }

    // Step 1: Atomically assign booking (cross-service — already atomic via findOneAndUpdate)
    let booking: any;
    try {
      const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
      const assignRes = await axios.put(`${BOOKING_URL}/api/bookings/internal/${request.booking_id}/assign`, {
        provider_id: provider._id
      }, {
        headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
      });
      booking = assignRes.data;
    } catch (err: any) {
      // Graceful idempotency check for double-clicks / concurrent requests
      try {
        const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
        const checkRes = await axios.get(`${BOOKING_URL}/api/bookings/internal/${request.booking_id}`, {
          headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
        });
        if (checkRes.data && String(checkRes.data.provider_id) === String(provider._id)) {
          res.json({ message: 'Job already accepted', booking: checkRes.data });
          return;
        }
      } catch (_) {}

      const msg = err.response?.data?.message || 'Booking is already assigned or unavailable';
      res.status(err.response?.status === 409 ? 409 : 400).json({ message: msg });
      return;
    }

    // Step 2: Transaction — update JobRequest + Provider atomically in provider_db
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        request.status = 'accepted';
        await request.save({ session });

        // Expire all competing job requests for this booking (keep history, don't delete)
        await JobRequest.updateMany(
          { booking_id: request.booking_id, status: 'pending', _id: { $ne: request._id } },
          { $set: { status: 'expired' } },
          { session }
        );

        // Check if provider has active Lead Package balance
        const now = new Date();
        const activeLeadOrders = await LeadPackageOrder.find({
          provider_id: provider._id,
          paymentStatus: 'success',
          leadsRemaining: { $gt: 0 },
          $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }]
        }).sort({ purchasedAt: 1 }).session(session);

        const totalActiveLeadsBefore = activeLeadOrders.reduce((sum, o) => sum + o.leadsRemaining, 0);

        if (totalActiveLeadsBefore > 0) {
          // FIFO lead deduction from oldest active package order
          const oldestOrder = activeLeadOrders[0];
          oldestOrder.leadsRemaining -= 1;
          await oldestOrder.save({ session });

          const totalActiveLeadsAfter = totalActiveLeadsBefore - 1;

          // Record LeadTransaction ledger entry
          await LeadTransaction.create([{
            provider_id: provider._id,
            package_order_id: oldestOrder._id,
            type: 'deduction',
            leadAmount: 1,
            balanceAfter: totalActiveLeadsAfter,
            referenceId: String(request.booking_id),
            description: `1 Lead deducted for job acceptance #${booking.booking_id}`
          }], { session });

          // Smart Low Lead Notification Check (20, 10, 5, 1, 0)
          const thresholds = [20, 10, 5, 1, 0];
          if (thresholds.includes(totalActiveLeadsAfter) && provider.lastLeadNotificationThreshold !== totalActiveLeadsAfter) {
            provider.lastLeadNotificationThreshold = totalActiveLeadsAfter;
            const alertMsg = totalActiveLeadsAfter === 0
              ? `Your lead balance has reached 0. Recharge a lead package to continue receiving new customer bookings.`
              : `Your lead balance is low. Only ${totalActiveLeadsAfter} lead${totalActiveLeadsAfter > 1 ? 's are' : ' is'} remaining. Recharge now to continue receiving bookings.`;

            emitToUser(String(provider.user_id), 'provider_notification', {
              title: 'Low Lead Balance Alert',
              message: alertMsg,
              remainingLeads: totalActiveLeadsAfter
            });
          }

          // Release any hold reservation if present
          const holdTx = await WalletTransaction.findOne({
            provider_id: provider._id,
            type: 'hold',
            referenceId: String(request.booking_id)
          }).session(session);

          if (holdTx) {
            provider.reservedBalance = Math.max(0, provider.reservedBalance - holdTx.amount);
          }
        } else {
          // Enforce cash lead fee deduction if no active leads
          const alreadyDeducted = await WalletTransaction.findOne({
            type: 'deduction',
            referenceId: String(request.booking_id)
          }).session(session);

          if (!alreadyDeducted && !isFreeAccessActive(provider)) {
            const holdTx = await WalletTransaction.findOne({
              provider_id: provider._id,
              type: 'hold',
              referenceId: String(request.booking_id)
            }).session(session);

            const leadFee = holdTx ? holdTx.amount : 100;

            if (holdTx) {
              provider.reservedBalance = Math.max(0, provider.reservedBalance - leadFee);
            }

            const creditToCheck = holdTx ? provider.availableCredit : (provider.availableCredit - leadFee);
            if (creditToCheck < 0) {
              throw new Error(`Deduction rejected: transaction would exceed the -₹${provider.creditLimit || 500} credit limit.`);
            }

            provider.walletBalance -= leadFee;

            await WalletTransaction.create([{
              provider_id: provider._id,
              type: 'deduction',
              amount: leadFee,
              balanceAfter: provider.walletBalance - provider.reservedBalance,
              referenceId: String(request.booking_id),
              description: `Lead fee deduction for booking #${booking.booking_id}`,
              status: 'success'
            }], { session });
          }
        }

        provider.jobsCompletedToday = (provider.jobsCompletedToday || 0) + 1;
        provider.availability_status = 'busy';
        provider.isBusy = true;
        await provider.save({ session });
      });
    } finally {
      await session.endSession();
    }

    // Step 3: Notify customer via socket (fire-and-forget, non-critical)
    emitToUser(booking.user_id.toString(), 'booking_accepted', {
      booking_id: booking._id,
      provider: {
        name:          req.user?.name,
        profile_image: req.user?.profile_image
      }
    });

    res.json({ message: 'Job accepted successfully', booking });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  } finally {
    if (isLockedByUs && lockKey && isRedisAvailable && redisClient) {
      await redisClient.del(lockKey).catch(() => {});
    }
  }
};

// @desc    Reject a job request
// @route   POST /api/providers/job-requests/:id/reject
// @access  Private/Provider
export const rejectJobRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const request = await JobRequest.findById(req.params.id);
    if (!request) {
      res.status(404).json({ message: 'Request not found' });
      return;
    }

    request.status = 'rejected';
    await request.save();

    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (provider) {
      const holdTx = await WalletTransaction.findOne({
        provider_id: provider._id,
        type: 'hold',
        referenceId: String(request.booking_id)
      });
      if (holdTx) {
        const releaseTx = await WalletTransaction.findOne({
          type: 'release',
          referenceId: String(request.booking_id)
        });
        if (!releaseTx) {
          provider.reservedBalance = Math.max(0, provider.reservedBalance - holdTx.amount);
          await provider.save();

          await WalletTransaction.create({
            provider_id: provider._id,
            type: 'release',
            amount: holdTx.amount,
            balanceAfter: provider.walletBalance - provider.reservedBalance,
            referenceId: String(request.booking_id),
            description: `Release hold for booking reject #${request.booking_id}`,
            status: 'success'
          });
        }
      }
    }

    res.json({ message: 'Job rejected successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
