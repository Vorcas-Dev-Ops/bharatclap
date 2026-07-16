import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Provider } from '../../models/Provider';
import { JobRequest } from '../../models/JobRequest';
import { WalletTransaction } from '../../models/WalletTransaction';
import { LeadFeeConfig } from '../../models/LeadFeeConfig';
import { emitToUser } from '../../services/socketService';
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
      const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://localhost:5004';
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

    // Step 1: Atomically assign booking (cross-service — already atomic via findOneAndUpdate)
    let booking: any;
    try {
      const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://localhost:5004';
      const assignRes = await axios.put(`${BOOKING_URL}/api/bookings/internal/${request.booking_id}/assign`, {
        provider_id: provider._id
      }, {
        headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
      });
      booking = assignRes.data;
    } catch (err: any) {
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

        // Enforce lead fee deduction
        const alreadyDeducted = await WalletTransaction.findOne({
          type: 'deduction',
          referenceId: String(request.booking_id)
        }).session(session);

        if (!alreadyDeducted) {
          const holdTx = await WalletTransaction.findOne({
            provider_id: provider._id,
            type: 'hold',
            referenceId: String(request.booking_id)
          }).session(session);

          const leadFee = holdTx ? holdTx.amount : 100;

          if (holdTx) {
            // Release the hold reservation and convert to deduction
            provider.reservedBalance = Math.max(0, provider.reservedBalance - leadFee);
          }

          // If holdTx was already checked, availableCredit already includes the hold amount.
          // Otherwise, we subtract it from availableCredit.
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
