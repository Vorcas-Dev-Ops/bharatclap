import { Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { AuthRequest } from '../../middleware/authMiddleware';
import { UserRepository } from '../../repositories/userRepository';
import { OtpRepository } from '../../repositories/otpRepository';
import { PhoneChangeRepository } from '../../repositories/phoneChangeRepository';
import { withTransaction } from '@bharatclap/shared';
import { getDb } from '../../config/db';

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 5;
const MAX_DAILY_CHANGES = 2;
const OTP_PEPPER = process.env.OTP_PEPPER || 'bharatclap_secure_otp_pepper_2026';

function hashOtp(otp: string, identifier: string): string {
  return crypto.createHmac('sha256', OTP_PEPPER).update(`${identifier}:${otp}`).digest('hex');
}

/** IST calendar-day start for the 2/day limit */
function startOfTodayIST(): Date {
  const now = new Date();
  const istString = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
  return new Date(`${istString}T00:00:00+05:30`);
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone;
  const visible = phone.slice(-4);
  const prefix = phone.slice(0, phone.length - 10).replace(/./g, c => c) || '';
  return `${prefix}${'*'.repeat(Math.max(0, phone.length - prefix.length - 4))}${visible}`;
}

/** Send OTP via MSG91 or mock in dev */
async function sendSmsOtp(phone: string, otpCode: string): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV OTP] Phone change OTP for ${phone}: ${otpCode}`);
  }
  if (process.env.MSG91_AUTHKEY && process.env.MSG91_TEMPLATE_ID) {
    const mobile = phone.replace(/^\+/, '');
    const formattedMobile = mobile.startsWith('91') ? mobile : `91${mobile}`;
    await axios.post(
      'https://control.msg91.com/api/v5/otp',
      { OTP: otpCode },
      {
        params: {
          authkey: process.env.MSG91_AUTHKEY,
          template_id: process.env.MSG91_TEMPLATE_ID,
          mobile: formattedMobile,
        },
        headers: { 'Content-Type': 'application/json' },
      }
    );
    console.log(`[PHONE_CHANGE] SMS OTP sent via MSG91 to ${formattedMobile}`);
  } else {
    console.log(`[MOCK SMS] Phone change OTP dispatched to ${phone}`);
  }
}

// ─── POST /api/users/phone/change/request-otp ────────────────────────

export const requestOtp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) { res.status(401).json({ message: 'Not authenticated' }); return; }

    const newPhone = (req.body.new_phone || '').toString().trim();
    const clean = newPhone.replace(/\D/g, '');
    if (clean.length < 10 || clean.length > 15) {
      res.status(400).json({ message: 'Invalid phone number format.' });
      return;
    }

    const user = await UserRepository.findById(userId);
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }

    // Same number check
    if (user.phone === newPhone) {
      res.status(400).json({ message: 'New phone number must be different from your current number.' });
      return;
    }

    // Already registered check
    const phoneTaken = await UserRepository.findByPhone(newPhone);
    if (phoneTaken && phoneTaken.id !== userId && phoneTaken.legacy_mongo_id !== userId) {
      res.status(400).json({ message: 'This phone number is already registered to another account.' });
      return;
    }

    // Daily limit (IST calendar day)
    const todayStart = startOfTodayIST();
    const changesToday = await PhoneChangeRepository.countChangesToday(userId, todayStart);
    if (changesToday >= MAX_DAILY_CHANGES) {
      res.status(429).json({ message: 'Daily phone change limit reached. You can change your phone number again tomorrow.' });
      return;
    }

    // Resend cooldown
    const latestChallenge = await OtpRepository.findLatest(newPhone, 'PHONE_CHANGE');
    if (latestChallenge) {
      const elapsedMs = Date.now() - new Date(latestChallenge.created_at).getTime();
      if (elapsedMs < RESEND_COOLDOWN_MS) {
        const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsedMs) / 1000);
        res.status(429).json({ message: `Please wait ${waitSec} seconds before requesting a new OTP.` });
        return;
      }
    }

    // Invalidate previous pending & create record
    await PhoneChangeRepository.createPendingChange(userId, newPhone);

    // Generate & hash OTP
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashOtp(otpCode, newPhone);

    await OtpRepository.createChallenge({
      identifier: newPhone,
      purpose: 'PHONE_CHANGE',
      otpHash,
      role: user.role || 'customer',
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    });

    try {
      await sendSmsOtp(newPhone, otpCode);
    } catch (smsErr: any) {
      console.error('[PHONE_CHANGE] SMS send failed:', smsErr?.response?.data || smsErr?.message);
    }

    res.json({ success: true, message: 'OTP sent successfully', expires_in: OTP_EXPIRY_MS / 1000 });
  } catch (err: any) {
    console.error('[PHONE_CHANGE] requestOtp error:', err?.message);
    res.status(500).json({ message: 'Failed to process phone change request' });
  }
};

// ─── POST /api/users/phone/change/verify-otp ─────────────────────────

export const verifyOtp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) { res.status(401).json({ message: 'Not authenticated' }); return; }

    const otp = String(req.body.otp || '').trim();
    if (!otp || otp.length !== 6) {
      res.status(400).json({ message: 'Please provide a valid 6-digit OTP.' });
      return;
    }

    const pending = await PhoneChangeRepository.findPendingChange(userId);
    if (!pending) {
      res.status(400).json({ message: 'No pending phone change request. Please request a new OTP.' });
      return;
    }

    const challenge = await OtpRepository.findActive(pending.new_phone, 'PHONE_CHANGE');
    if (!challenge) {
      res.status(400).json({ message: 'OTP has expired or challenge not found. Please request a new one.' });
      return;
    }

    if (challenge.status === 'locked' || challenge.attempts >= MAX_ATTEMPTS) {
      await OtpRepository.lock(challenge.id);
      res.status(429).json({ message: 'Too many incorrect attempts. Please request a new OTP.' });
      return;
    }

    // Compare OTP hash
    const expectedHash = challenge.otp_hash;
    const submittedHash = hashOtp(otp, pending.new_phone);
    const expectedBuf = Buffer.from(expectedHash, 'utf8');
    const submittedBuf = Buffer.from(submittedHash, 'utf8');

    const isMatch =
      expectedBuf.length === submittedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, submittedBuf);

    if (!isMatch) {
      const attempts = await OtpRepository.incrementAttempts(challenge.id);
      if (attempts >= MAX_ATTEMPTS) {
        await OtpRepository.lock(challenge.id);
        res.status(429).json({ message: 'Too many incorrect attempts. Please request a new OTP.' });
        return;
      }
      const remaining = MAX_ATTEMPTS - attempts;
      res.status(400).json({ message: `Invalid OTP. ${remaining} attempt(s) remaining.` });
      return;
    }

    // ── OTP matched — perform atomic update via transaction ──
    const user = await UserRepository.findById(userId);
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }

    const oldPhone = user.phone || '';
    const newPhone = pending.new_phone;

    const pool = getDb();
    try {
      await withTransaction(pool, async (client) => {
        // Race guard: check if another user claimed this number concurrently
        const conflictRes = await client.query(
          `SELECT id FROM auth.users WHERE phone = $1 AND id::text != $2 AND deleted_at IS NULL LIMIT 1`,
          [newPhone, userId]
        );
        if (conflictRes.rows.length > 0) {
          throw new Error('PHONE_TAKEN');
        }

        await client.query(
          `UPDATE auth.users SET phone = $1, is_phone_verified = TRUE, updated_at = NOW() WHERE id::text = $2`,
          [newPhone, userId]
        );

        await client.query(
          `UPDATE auth.otp_challenges SET status = 'consumed', consumed_at = NOW() WHERE id = $1`,
          [challenge.id]
        );

        await PhoneChangeRepository.markPendingVerified(client, pending.id);
        await PhoneChangeRepository.recordHistory(client, userId, oldPhone, newPhone);
      });
    } catch (txErr: any) {
      if (txErr?.message === 'PHONE_TAKEN') {
        res.status(409).json({ message: 'This phone number was just registered to another account. Please try a different number.' });
        return;
      }
      throw txErr;
    }

    res.json({ success: true, message: 'Phone number changed successfully', phone: maskPhone(newPhone) });
  } catch (err: any) {
    console.error('[PHONE_CHANGE] verifyOtp error:', err?.message);
    res.status(500).json({ message: 'Failed to verify OTP' });
  }
};

// ─── GET /api/users/phone/change/status ──────────────────────────────

export const getStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) { res.status(401).json({ message: 'Not authenticated' }); return; }

    const todayStart = startOfTodayIST();
    const changesToday = await PhoneChangeRepository.countChangesToday(userId, todayStart);

    res.json({ available: changesToday < MAX_DAILY_CHANGES, changes_today: changesToday, max_changes: MAX_DAILY_CHANGES });
  } catch (err: any) {
    console.error('[PHONE_CHANGE] getStatus error:', err?.message);
    res.status(500).json({ message: 'Failed to fetch phone change status' });
  }
};
