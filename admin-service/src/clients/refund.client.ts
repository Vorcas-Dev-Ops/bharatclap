import axios from 'axios';
import { ENV } from '../config/env';

const headers = { 'x-internal-service-key': ENV.INTERNAL_SERVICE_KEY };

export class RefundClient {
  static async getRefundsByUser(userId: string) {
    try {
      const res = await axios.get(`${ENV.REFUND_SERVICE_URL}/api/refunds?user_id=${userId}`, { headers, timeout: 4000 });
      return res.data?.data || [];
    } catch (err) {
      return [];
    }
  }

  static async getAllRefunds() {
    try {
      const res = await axios.get(`${ENV.REFUND_SERVICE_URL}/api/refunds`, { headers, timeout: 4000 });
      return res.data?.data || [];
    } catch (err) {
      return [];
    }
  }
}
