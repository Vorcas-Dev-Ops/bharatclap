import axios from 'axios';
import { ENV } from '../config/env';

const headers = { 'x-internal-service-key': ENV.INTERNAL_SERVICE_KEY };

export class AuthClient {
  static async getCustomerProfile(userId: string) {
    try {
      const res = await axios.get(`${ENV.AUTH_SERVICE_URL}/api/users/${userId}`, { headers, timeout: 4000 });
      return res.data?.data || res.data;
    } catch (err) {
      return null;
    }
  }

  static async getCustomerAddresses(userId: string) {
    try {
      const res = await axios.get(`${ENV.AUTH_SERVICE_URL}/api/address/user/${userId}`, { headers, timeout: 4000 });
      return res.data?.data || [];
    } catch (err) {
      return [];
    }
  }

  static async getAllUsers() {
    try {
      const res = await axios.get(`${ENV.AUTH_SERVICE_URL}/api/users`, { headers, timeout: 4000 });
      return res.data?.data || [];
    } catch (err) {
      return [];
    }
  }
}
