import { Booking } from '../models/Booking';
import axios from 'axios';
import { getAddressesBatch } from '../utils/internalApi';

const PROVIDER_SERVICE_URL = process.env.PROVIDER_SERVICE_URL || 'http://localhost:5003';

export const dispatchNearbyProviders = async (bookingId: string) => {
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) return;

    await Booking.findByIdAndUpdate(bookingId, { status: 'provider_searching' });

    // Fetch the address for coordinates
    const addresses = await getAddressesBatch([booking.address_id.toString()]);
    const address = addresses.length > 0 ? addresses[0] : null;

    if (!address) {
      console.log(`[DISPATCH] ❌ No address found for booking ${booking.booking_id}`);
      return;
    }

    // Call Provider Service to handle the complex $geoNear dispatch logic
    // It will return the assigned provider ID if found, and it handles creating JobRequests
    const response = await axios.post(`${PROVIDER_SERVICE_URL}/api/providers/internal/dispatch`, {
      booking: booking.toObject ? booking.toObject() : booking,
      address
    });

    if (response.data && response.data.provider_id) {
      await Booking.findByIdAndUpdate(bookingId, { provider_id: response.data.provider_id });
      console.log(`[DISPATCH] Provider ${response.data.provider_id} auto-assigned to booking ${booking.booking_id}`);
    } else {
      console.log(`[DISPATCH] ❌ No provider found for booking ${booking.booking_id}`);
    }
  } catch (error: any) {
    console.error('[DISPATCH] Pipeline error:', error?.response?.data || error.message);
  }
};

export const dispatchBooking = dispatchNearbyProviders;
