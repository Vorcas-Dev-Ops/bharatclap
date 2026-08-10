import axios from 'axios';
import { ENV } from '../config/env';

const headers = { 'x-internal-service-key': ENV.INTERNAL_SERVICE_KEY };

export class BookingClient {
  static async getBookingsByUser(userId: string) {
    try {
      const res = await axios.get(`${ENV.BOOKING_SERVICE_URL}/api/bookings?user_id=${userId}`, { headers, timeout: 4000 });
      return res.data?.data || [];
    } catch (err) {
      return [];
    }
  }

  static async getBookingsByProvider(providerId: string) {
    try {
      const res = await axios.get(`${ENV.BOOKING_SERVICE_URL}/api/bookings?provider_id=${providerId}`, { headers, timeout: 4000 });
      return res.data?.data || [];
    } catch (err) {
      return [];
    }
  }

  static async getComplaintsByUser(userId: string) {
    try {
      const res = await axios.get(`${ENV.BOOKING_SERVICE_URL}/api/complaints?user_id=${userId}`, { headers, timeout: 4000 });
      return res.data?.data || [];
    } catch (err) {
      return [];
    }
  }

  static async getReviewsByProvider(providerId: string) {
    try {
      const res = await axios.get(`${ENV.BOOKING_SERVICE_URL}/api/reviews?provider_id=${providerId}`, { headers, timeout: 4000 });
      return res.data?.data || [];
    } catch (err) {
      return [];
    }
  }

  static async getAllBookings() {
    try {
      const res = await axios.get(`${ENV.BOOKING_SERVICE_URL}/api/bookings`, { headers, timeout: 4000 });
      return res.data?.data || [];
    } catch (err) {
      return [];
    }
  }
}
