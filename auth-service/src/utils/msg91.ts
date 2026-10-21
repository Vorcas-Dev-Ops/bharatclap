import axios from 'axios';
import https from 'https';
import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

const ipv4Agent = new https.Agent({ family: 4, keepAlive: true });

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

/**
 * MSG91 OTP & Email Integration Service
 * Based on official MSG91 API v5 Documentation:
 * - Send OTP (SMS): POST https://control.msg91.com/api/v5/otp
 * - Verify OTP: GET https://control.msg91.com/api/v5/otp/verify
 * - Retry/Resend OTP: GET https://control.msg91.com/api/v5/otp/retry
 * - Send Email (OTP/Transactional): POST https://control.msg91.com/api/v5/email/send
 * - OTP Widget API: POST https://api.msg91.com/api/v5/widget/sendOtp
 */

export interface Msg91OtpResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

export function formatMobile(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length === 10) return `91${digitsOnly}`;
  if (digitsOnly.startsWith('91') && digitsOnly.length === 12) return digitsOnly;
  return digitsOnly;
}

/**
 * Send SMS OTP via MSG91 API v5
 */
export async function sendMsg91SmsOtp(phone: string, otpCode: string): Promise<Msg91OtpResult> {
  const authKey = process.env.MSG91_AUTHKEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  const senderId = process.env.MSG91_SENDER_ID || 'BHRTCP';

  if (!authKey || !templateId) {
    console.log(`[MSG91 SMS MOCK] Missing MSG91_AUTHKEY or MSG91_TEMPLATE_ID. OTP for ${phone}: ${otpCode}`);
    return { success: true, message: 'Mock SMS dispatched (missing MSG91 keys)' };
  }

  const mobile = formatMobile(phone);

  try {
    const params: Record<string, any> = {
      authkey: authKey,
      template_id: templateId,
      mobile: mobile,
      otp: otpCode,
      otp_expiry: 5, // 5 minutes
      otp_length: 6,
    };
    if (senderId) {
      params.sender = senderId;
    }

    const res = await axios.post(
      'https://control.msg91.com/api/v5/otp',
      {
        OTP: otpCode,
        otp: otpCode,
        var: otpCode,
        var1: otpCode,
        code: otpCode,
      },
      {
        params,
        headers: {
          'Content-Type': 'application/json',
          'authkey': authKey,
        },
        httpsAgent: ipv4Agent,
        timeout: 8000,
      }
    );

    if (res.data?.type === 'error') {
      console.error('[MSG91 SMS ERROR]', res.data);
      return { success: false, error: res.data?.message || 'MSG91 rejected SMS request' };
    }

    console.log(`[MSG91 SMS SUCCESS] OTP sent to ${mobile}, request_id: ${res.data?.request_id || 'N/A'}, message: ${res.data?.message || 'OK'}`);
    return { success: true, data: res.data };
  } catch (err: any) {
    const errorMsg = err.response?.data?.message || err.response?.data || err.message;
    console.error('[MSG91 SMS EXCEPTION]', errorMsg);
    return { success: false, error: String(errorMsg) };
  }
}

/**
 * Send Email OTP via MSG91 Email API v5
 */
export async function sendMsg91EmailOtp(email: string, otpCode: string): Promise<Msg91OtpResult> {
  const authKey = process.env.MSG91_AUTHKEY;
  const templateId = process.env.MSG91_EMAIL_TEMPLATE_ID;
  const domain = process.env.MSG91_EMAIL_DOMAIN;
  const fromEmail = process.env.MSG91_EMAIL_FROM_EMAIL || `otp@${domain || 'bharatclap.com'}`;
  const fromName = process.env.MSG91_EMAIL_FROM_NAME || 'BharatClap';

  if (!authKey || !templateId) {
    return { success: false, error: 'MSG91_EMAIL_TEMPLATE_ID or MSG91_AUTHKEY not configured' };
  }

  try {
    const payload = {
      recipients: [
        {
          to: [{ email: email.trim().toLowerCase() }],
          variables: {
            otp: otpCode,
            OTP: otpCode,
            code: otpCode,
          },
        },
      ],
      from: {
        name: fromName,
        email: fromEmail,
      },
      domain: domain || undefined,
      template_id: templateId,
    };

    const res = await axios.post('https://control.msg91.com/api/v5/email/send', payload, {
      headers: {
        'Content-Type': 'application/json',
        'authkey': authKey,
      },
      httpsAgent: ipv4Agent,
      timeout: 8000,
    });

    if (res.data?.type === 'error' || res.data?.status === 'error') {
      console.error('[MSG91 EMAIL ERROR]', res.data);
      return { success: false, error: res.data?.message || 'MSG91 rejected email request' };
    }

    console.log(`[MSG91 EMAIL SUCCESS] OTP email sent to ${email}`);
    return { success: true, data: res.data };
  } catch (err: any) {
    const errorMsg = err.response?.data?.message || err.response?.data || err.message;
    console.error('[MSG91 EMAIL EXCEPTION]', errorMsg);
    return { success: false, error: String(errorMsg) };
  }
}

/**
 * Verify OTP directly with MSG91 API v5
 */
export async function verifyMsg91Otp(phone: string, otpCode: string): Promise<boolean> {
  const authKey = process.env.MSG91_AUTHKEY;
  if (!authKey) return false;

  const mobile = formatMobile(phone);

  try {
    const res = await axios.get('https://control.msg91.com/api/v5/otp/verify', {
      params: {
        otp: otpCode,
        mobile: mobile,
      },
      headers: {
        authkey: authKey,
      },
      httpsAgent: ipv4Agent,
      timeout: 8000,
    });

    return res.data?.type === 'success' || res.data?.message === 'OTP verified success';
  } catch (err: any) {
    console.error('[MSG91 VERIFY ERROR]', err.response?.data || err.message);
    return false;
  }
}

/**
 * Resend/Retry OTP via MSG91 API v5
 */
export async function retryMsg91Otp(phone: string, retryType: 'text' | 'voice' = 'text'): Promise<Msg91OtpResult> {
  const authKey = process.env.MSG91_AUTHKEY;
  if (!authKey) return { success: false, error: 'MSG91_AUTHKEY not configured' };

  const mobile = formatMobile(phone);

  try {
    const res = await axios.get('https://control.msg91.com/api/v5/otp/retry', {
      params: {
        authkey: authKey,
        mobile: mobile,
        retrytype: retryType,
      },
      headers: {
        authkey: authKey,
      },
      httpsAgent: ipv4Agent,
      timeout: 8000,
    });

    if (res.data?.type === 'error') {
      return { success: false, error: res.data?.message || 'Retry failed' };
    }

    return { success: true, data: res.data };
  } catch (err: any) {
    return { success: false, error: err.response?.data?.message || err.message };
  }
}
