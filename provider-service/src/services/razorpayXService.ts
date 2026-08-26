import axios from 'axios';
import http from 'http';
import https from 'https';

function getRzpAuth() {
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_ID || 'rzp_test_mock_key';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || 'mock_secret_key';
  return { username: keyId, password: keySecret, isMock: keyId.startsWith('rzp_test_mock') };
}

if (!process.env.RAZORPAY_KEY_ID && process.env.NODE_ENV === 'production') {
  throw new Error('[RazorpayX] RAZORPAY_KEY_ID missing in production — refusing to boot on mock keys');
}

const keepAliveAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const keepAliveHttpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

function getClient() {
  const auth = getRzpAuth();
  return axios.create({
    baseURL: 'https://api.razorpay.com/v1',
    auth: { username: auth.username, password: auth.password },
    timeout: 10000,
    httpAgent: keepAliveAgent,
    httpsAgent: keepAliveHttpsAgent,
  });
}

export interface RazorpayContactResponse {
  id: string;
  name: string;
  email?: string;
  contact?: string;
  type: string;
  status: string;
}

export interface RazorpayFundAccountResponse {
  id: string;
  contact_id: string;
  account_type: string;
  bank_account?: {
    name: string;
    ifsc: string;
    account_number: string;
  };
}

export interface RazorpayPayoutResponse {
  id: string;
  entity: string;
  fund_account_id: string;
  amount: number;
  currency: string;
  notes?: Record<string, any>;
  fees?: number;
  tax?: number;
  status: 'queued' | 'pending' | 'processing' | 'processed' | 'cancelled' | 'reversed' | 'rejected';
  utr?: string;
  mode?: string;
  purpose?: string;
  failure_reason?: string;
  created_at?: number;
}

/**
 * Classifies failure into retryable vs non-retryable
 */
export function classifyFailure(errorCode?: string, errorDesc?: string, statusCode?: number): { isRetryable: boolean; failureReason: string } {
  const code = (errorCode || '').toUpperCase();
  const desc = errorDesc || 'Payout processing failed';

  // Non-retryable permanent failures
  const nonRetryableCodes = [
    'INVALID_ACCOUNT',
    'INVALID_IFSC',
    'ACCOUNT_CLOSED',
    'ACCOUNT_BLOCKED',
    'BENEFICIARY_NAME_MISMATCH',
    'COMPLIANCE_HOLD',
    'BAD_REQUEST_ERROR',
    'REJECTED',
  ];

  if (nonRetryableCodes.some(c => code.includes(c) || desc.toUpperCase().includes(c))) {
    return {
      isRetryable: false,
      failureReason: `Non-retryable Payout Failure: ${desc} (code: ${code || 'PERMANENT_REJECT'})`,
    };
  }

  // Gateway timeouts and 5xx errors are retryable
  if (statusCode && statusCode >= 500) {
    return {
      isRetryable: true,
      failureReason: `Retryable Gateway Error (${statusCode}): ${desc}`,
    };
  }

  return {
    isRetryable: true,
    failureReason: `Retryable Payout Failure: ${desc} (code: ${code || 'TEMPORARY_FAILURE'})`,
  };
}

export const razorpayXService = {
  /**
   * Create RazorpayX Contact for Provider
   */
  async createContact(provider: any): Promise<RazorpayContactResponse> {
    const auth = getRzpAuth();
    if (auth.isMock) {
      return {
        id: `cont_${provider._id.toString().slice(-8)}_${Date.now()}`,
        name: provider.bankDetails?.accountHolderName || provider.name || 'BharatClap Provider',
        type: 'vendor',
        status: 'active',
      };
    }

    try {
      const response = await getClient().post('/contacts', {
        name: provider.bankDetails?.accountHolderName || provider.name || 'BharatClap Provider',
        email: provider.email || `provider_${provider._id}@bharatclap.com`,
        contact: provider.phone || '9999999999',
        type: 'vendor',
        reference_id: provider._id.toString(),
        notes: {
          provider_code: provider.provider_code || '',
        },
      });
      return response.data;
    } catch (err: any) {
      console.error('[RazorpayX] Error creating contact:', err.response?.data || err.message);
      throw new Error(err.response?.data?.error?.description || 'Failed to create RazorpayX Contact');
    }
  },

  /**
   * Create RazorpayX Fund Account (Bank Account) for Provider
   */
  async createFundAccount(contactId: string, bankDetails: any): Promise<RazorpayFundAccountResponse> {
    const auth = getRzpAuth();
    if (auth.isMock) {
      return {
        id: `fa_${contactId.slice(-8)}_${Date.now()}`,
        contact_id: contactId,
        account_type: 'bank_account',
        bank_account: {
          name: bankDetails.accountHolderName,
          ifsc: bankDetails.ifscCode,
          account_number: bankDetails.accountNumber,
        },
      };
    }

    try {
      const response = await getClient().post('/fund_accounts', {
        contact_id: contactId,
        account_type: 'bank_account',
        bank_account: {
          name: bankDetails.accountHolderName,
          ifsc: bankDetails.ifscCode,
          account_number: bankDetails.accountNumber,
        },
      });
      return response.data;
    } catch (err: any) {
      console.error('[RazorpayX] Error creating fund account:', err.response?.data || err.message);
      throw new Error(err.response?.data?.error?.description || 'Failed to create RazorpayX Fund Account');
    }
  },

  /**
   * Validate a RazorpayX Fund Account via penny-drop (async — result arrives via webhook)
   */
  async validateFundAccount(fundAccountId: string) {
    const auth = getRzpAuth();
    if (auth.isMock) {
      console.warn('[RazorpayX] MOCK MODE — validateFundAccount returning fake pending status');
      return { id: `fav_mock_${Date.now()}`, status: 'created' };
    }
    try {
      const response = await getClient().post('/fund_accounts/validations', {
        fund_account: { id: fundAccountId },
        amount: 100,
        currency: 'INR',
      });
      return response.data;
    } catch (err: any) {
      console.error('[RazorpayX] validateFundAccount error:', err.response?.data || err.message);
      throw err;
    }
  },

  /**
   * Create RazorpayX Payout with X-Payout-Idempotency header
   */
  async createPayout(
    fundAccountId: string,
    amountRupees: number,
    idempotencyKey: string,
    narration = 'BharatClap Earnings Payout'
  ): Promise<RazorpayPayoutResponse> {
    const amountPaise = Math.round(amountRupees * 100);
    const auth = getRzpAuth();

    if (auth.isMock) {
      const isMockFail = idempotencyKey.includes('FAIL');
      if (isMockFail) {
        throw {
          response: {
            status: 400,
            data: {
              error: {
                code: 'INVALID_ACCOUNT',
                description: 'Mock Beneficiary Bank Account Rejected Payout',
              },
            },
          },
        };
      }

      return {
        id: `pout_mock_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        entity: 'payout',
        fund_account_id: fundAccountId,
        amount: amountPaise,
        currency: 'INR',
        status: 'processing',
        utr: `UTR${Date.now()}`,
        mode: 'NEFT',
        purpose: 'payout',
      };
    }

    try {
      const accountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER || '233445566778899';
      const response = await getClient().post(
        '/payouts',
        {
          account_number: accountNumber,
          fund_account_id: fundAccountId,
          amount: amountPaise,
          currency: 'INR',
          mode: 'NEFT',
          purpose: 'payout',
          narration: narration.slice(0, 30),
        },
        {
          headers: {
            'X-Payout-Idempotency': idempotencyKey,
          },
        }
      );
      return response.data;
    } catch (err: any) {
      console.error('[RazorpayX] Error creating payout:', err.response?.data || err.message);
      throw err;
    }
  },

  /**
   * Query Payout Status by Payout ID
   */
  async getPayoutStatus(payoutId: string): Promise<RazorpayPayoutResponse> {
    const auth = getRzpAuth();
    if (auth.isMock) {
      return {
        id: payoutId,
        entity: 'payout',
        fund_account_id: 'fa_mock',
        amount: 10000,
        currency: 'INR',
        status: 'processed',
        utr: `UTR_CONFIRMED_${Date.now()}`,
      };
    }

    try {
      const response = await getClient().get(`/payouts/${payoutId}`);
      return response.data;
    } catch (err: any) {
      console.error('[RazorpayX] Error querying payout status:', err.response?.data || err.message);
      throw err;
    }
  },
};
