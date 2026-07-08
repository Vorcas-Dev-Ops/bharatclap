import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Provider } from '../../models/Provider';
import { JobRequest } from '../../models/JobRequest';
import { emitToUser } from '../../services/socketService';
import { getUsersBatch, getCatalogBatch, getAddressesBatch, getBookingsBatch } from '../../utils/internalApi';
import axios from 'axios';

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

    const requests = await JobRequest.find({
      provider_id: provider._id,
      status: 'pending'
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
    if (!request || request.status !== 'pending') {
      res.status(400).json({ message: 'Request is no longer valid or has expired' });
      return;
    }

    let booking;
    try {
      const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://localhost:5004';
      const assignRes = await axios.put(`${BOOKING_URL}/api/bookings/internal/${request.booking_id}/assign`, {
        provider_id: provider._id
      }, {
        headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY || '' }
      });
      booking = assignRes.data;
    } catch (err: any) {
      res.status(400).json({ message: err.response?.data?.message || 'Booking is already assigned or unavailable' });
      return;
    }

    // 2. Mark this JobRequest as accepted
    request.status = 'accepted';
    await request.save();

    // 3. Remove all competing JobRequests for the same booking
    await JobRequest.updateMany(
      { booking_id: booking._id, _id: { $ne: request._id } },
      { status: 'removed' }
    );

    // 4. Mark provider as busy
    provider.availability_status = 'busy';
    provider.isBusy = true;
    await provider.save();

    // ── Notify customer via socket ───────────────────────────────────────────────
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

    res.json({ message: 'Job rejected successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
