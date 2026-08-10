import axios from 'axios';
import { ENV } from '../config/env';

const headers = { 'x-internal-service-key': ENV.INTERNAL_SERVICE_KEY };

export class PaymentClient {
  static async getPaymentsByUser(userId: string) {
    try {
      const res = await axios.get(`${ENV.PAYMENT_SERVICE_URL}/api/payments?user_id=${userId}`, { headers, timeout: 4000 });
      return res.data?.data || [];
    } catch (err) {
      return [];
    }
  }

  static async getAllPayments() {
    try {
      const res = await axios.get(`${ENV.PAYMENT_SERVICE_URL}/api/payments`, { headers, timeout: 4000 });
      return res.data?.data || [];
    } catch (err) {
      return [];
    }
  }
}
