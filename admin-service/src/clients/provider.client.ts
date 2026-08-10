import axios from 'axios';
import { ENV } from '../config/env';

const headers = { 'x-internal-service-key': ENV.INTERNAL_SERVICE_KEY };

export class ProviderClient {
  static async getProviderProfile(providerId: string) {
    try {
      const res = await axios.get(`${ENV.PROVIDER_SERVICE_URL}/api/providers/${providerId}`, { headers, timeout: 4000 });
      return res.data?.data || res.data;
    } catch (err) {
      return null;
    }
  }

  static async getProviderWallet(providerId: string) {
    try {
      const res = await axios.get(`${ENV.PROVIDER_SERVICE_URL}/api/wallets/${providerId}`, { headers, timeout: 4000 });
      return res.data?.data || null;
    } catch (err) {
      return null;
    }
  }

  static async getProviderPayouts(providerId: string) {
    try {
      const res = await axios.get(`${ENV.PROVIDER_SERVICE_URL}/api/payouts?provider_id=${providerId}`, { headers, timeout: 4000 });
      return res.data?.data || [];
    } catch (err) {
      return [];
    }
  }

  static async getAllProviders() {
    try {
      const res = await axios.get(`${ENV.PROVIDER_SERVICE_URL}/api/providers`, { headers, timeout: 4000 });
      return res.data?.data || [];
    } catch (err) {
      return [];
    }
  }
}
