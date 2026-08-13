import axios from 'axios';
import { ENV } from '../config/env';

const headers = { 'x-internal-service-key': ENV.INTERNAL_SERVICE_KEY };

export class DashboardService {
  static async getDashboardMetrics(filters: any = {}) {
    // ponytail: booking-service now computes everything (users, providers, bookings, revenue, stuck bookings, recent bookings)
    // — single downstream call instead of 3 separate ones
    const qs = new URLSearchParams();
    if (filters.startDate) qs.append('startDate', filters.startDate as string);
    if (filters.endDate) qs.append('endDate', filters.endDate as string);
    if (filters.category) qs.append('category', filters.category as string);
    if (filters.location) qs.append('location', filters.location as string);

    const qsStr = qs.toString() ? `?${qs.toString()}` : '';
    const res = await axios.get(
      `${ENV.BOOKING_SERVICE_URL}/api/admin/dashboard/stats${qsStr}`,
      { headers, timeout: 8000 }
    );

    // Pass through the booking-service response directly — it already has the complete DTO
    return res.data?.data || res.data || {};
  }
}
