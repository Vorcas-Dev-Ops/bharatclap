import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

/* ponytail: multi-layer OTP abuse protection pipeline with server-validated CAPTCHA & distributed attack defense */

interface RateRecord {
  count: number;
  resetAt: number;
}

// In-memory sliding rate windows
const ipStore = new Map<string, RateRecord>();
const targetPhoneStore = new Map<string, RateRecord>();
const deviceStore = new Map<string, RateRecord>();
let globalMinuteCount = 0;
let globalMinuteReset = Date.now() + 60000;

// Cleanup expired buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of ipStore.entries()) {
    if (now > val.resetAt) ipStore.delete(key);
  }
  for (const [key, val] of targetPhoneStore.entries()) {
    if (now > val.resetAt) targetPhoneStore.delete(key);
  }
  for (const [key, val] of deviceStore.entries()) {
    if (now > val.resetAt) deviceStore.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Validates CAPTCHA token with Turnstile / reCAPTCHA provider API.
 */
const verifyCaptchaServerSide = async (token: string, remoteip: string): Promise<boolean> => {
  const secretKey = process.env.TURNSTILE_SECRET_KEY || process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    // Development fallback if no secret configured
    return token.length > 5;
  }
  try {
    const res = await axios.post(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      new URLSearchParams({
        secret: secretKey,
        response: token,
        remoteip: remoteip,
      }),
      { timeout: 4000 }
    );
    return Boolean(res.data?.success);
  } catch (err: any) {
    console.error('[CAPTCHA_VERIFICATION_ERROR]', err?.message || err);
    return false;
  }
};

export const otpAbuseProtection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const now = Date.now();

  // 1. Global Service Throttling Guard (Max 300 OTPs per minute across system)
  if (now > globalMinuteReset) {
    globalMinuteCount = 0;
    globalMinuteReset = now + 60000;
  }
  globalMinuteCount++;
  if (globalMinuteCount > 300) {
    res.status(429).json({ message: 'Global OTP service limit reached. Please try again in 60 seconds.' });
    return;
  }

  // Extract request identifiers
  const ip = req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1';
  const rawTarget = req.body?.identifier || req.body?.phone || req.body?.email || '';
  const targetIdentifier = rawTarget.toString().trim().toLowerCase().replace(/\D/g, '') || rawTarget;
  const deviceFingerprint = (req.headers['x-device-fingerprint'] || req.headers['user-agent'] || 'unknown-device').toString();

  // 2. IP Rate Limit (Max 5 per 15 mins per IP)
  const ipRecord = ipStore.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (now > ipRecord.resetAt) {
    ipRecord.count = 0;
    ipRecord.resetAt = now + 15 * 60 * 1000;
  }
  ipRecord.count++;
  ipStore.set(ip, ipRecord);

  if (ipRecord.count > 5) {
    res.status(429).json({ message: 'Too many OTP requests from this IP. Please wait 15 minutes.' });
    return;
  }

  // 3. Target Phone / Account Rate Limit (Primary Distributed Botnet Defense: Max 3 per 15 mins per target)
  if (targetIdentifier) {
    const targetRecord = targetPhoneStore.get(targetIdentifier) || { count: 0, resetAt: now + 15 * 60 * 1000 };
    if (now > targetRecord.resetAt) {
      targetRecord.count = 0;
      targetRecord.resetAt = now + 15 * 60 * 1000;
    }
    targetRecord.count++;
    targetPhoneStore.set(targetIdentifier, targetRecord);

    if (targetRecord.count > 3) {
      res.status(429).json({ message: 'Too many OTP requests for this phone number/account. Please wait 15 minutes before retrying.' });
      return;
    }
  }

  // 4. Device / Session Burst Throttle (Max 3 per 5 mins)
  const devRecord = deviceStore.get(deviceFingerprint) || { count: 0, resetAt: now + 5 * 60 * 1000 };
  if (now > devRecord.resetAt) {
    devRecord.count = 0;
    devRecord.resetAt = now + 5 * 60 * 1000;
  }
  devRecord.count++;
  deviceStore.set(deviceFingerprint, devRecord);

  if (devRecord.count > 3) {
    res.status(429).json({ message: 'Burst limit reached on this device. Please wait 5 minutes.' });
    return;
  }

  // 5. CAPTCHA / Turnstile Risk Threshold Validation (Server-side API verification)
  const requiresCaptcha = (ipRecord.count > 2 || (targetIdentifier && (targetPhoneStore.get(targetIdentifier)?.count || 0) > 2));
  if (requiresCaptcha) {
    const captchaToken = (req.headers['x-captcha-token'] || req.body?.captchaToken)?.toString();
    if (!captchaToken) {
      res.status(403).json({
        message: 'Security verification required. Please complete the CAPTCHA to request OTP.',
        requireCaptcha: true
      });
      return;
    }

    const isValid = await verifyCaptchaServerSide(captchaToken, ip);
    if (!isValid) {
      res.status(403).json({
        message: 'CAPTCHA verification failed or expired. Please re-verify.',
        requireCaptcha: true
      });
      return;
    }
  }

  next();
};
