import { Response } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import { AuthRequest } from '../../middleware/authMiddleware';
import { User } from '../../models/User';
import { PendingPhoneChange } from '../../models/PendingPhoneChange';
import { PhoneChangeHistory } from '../../models/PhoneChangeHistory';

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 5;
const MAX_DAILY_CHANGES = 2;
const BCRYPT_ROUNDS = 10;

/** IST calendar-day start for the 2/day limit */
function startOfTodayIST(): Date {
  // ponytail: Intl gives us the real IST offset including any future DST changes (India doesn't have DST, but this is correct regardless)
  const now = new Date();
  const istString = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
  // Parse as IST midnight: append T00:00:00+05:30
  return new Date(`${istString}T00:00:00+05:30`);
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function maskPhone(phone: string): string {
  // "+919876543210" → "+91******3210"
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
    const userId = req.user?._id;
    if (!userId) { res.status(401).json({ message: 'Not authenticated' }); return; }

    const newPhone = (req.body.new_phone || '').toString().trim();
    const clean = newPhone.replace(/\D/g, '');
    if (clean.length < 10 || clean.length > 15) {
      res.status(400).json({ message: 'Invalid phone number format.' });
      return;
    }

    const user = await User.findById(userId).select('phone');
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }

    // Same number check
    if (user.phone === newPhone) {
      res.status(400).json({ message: 'New phone number must be different from your current number.' });
      return;
    }

    // Already registered check
    const phoneTaken = await User.findOne({ phone: newPhone, _id: { $ne: userId } });
    if (phoneTaken) {
      res.status(400).json({ message: 'This phone number is already registered to another account.' });
      return;
    }

    // Daily limit (IST calendar day)
    const todayStart = startOfTodayIST();
    const changesToday = await PhoneChangeHistory.countDocuments({ user_id: userId, changed_at: { $gte: todayStart } });
    if (changesToday >= MAX_DAILY_CHANGES) {
      res.status(429).json({ message: 'Daily phone change limit reached. You can change your phone number again tomorrow.' });
      return;
    }

    // Resend cooldown
    const lastPending = await PendingPhoneChange.findOne({ user_id: userId, status: 'pending' }).sort({ created_at: -1 });
    if (lastPending && (Date.now() - lastPending.created_at.getTime()) < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - lastPending.created_at.getTime())) / 1000);
      res.status(429).json({ message: `Please wait ${waitSec} seconds before requesting a new OTP.` });
      return;
    }

    // Invalidate any previous pending OTPs
    await PendingPhoneChange.deleteMany({ user_id: userId });

    // Generate & hash OTP
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otpCode, BCRYPT_ROUNDS);

    await PendingPhoneChange.create({
      user_id: userId,
      new_phone: newPhone,
      otp_hash: otpHash,
      expires_at: new Date(Date.now() + OTP_EXPIRY_MS),
      attempts: 0,
      status: 'pending',
    });

    // Send SMS (fire-and-forget for response, but await to catch errors)
    try {
      await sendSmsOtp(newPhone, otpCode);
    } catch (smsErr: any) {
      console.error('[PHONE_CHANGE] SMS send failed:', smsErr?.response?.data || smsErr?.message);
      // ponytail: still return success — OTP is stored, user can retry send. Don't leak SMS provider errors.
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
    const userId = req.user?._id;
    if (!userId) { res.status(401).json({ message: 'Not authenticated' }); return; }

    const otp = String(req.body.otp || '').trim();
    if (!otp || otp.length !== 6) {
      res.status(400).json({ message: 'Please provide a valid 6-digit OTP.' });
      return;
    }

    const pending = await PendingPhoneChange.findOne({ user_id: userId, status: 'pending' });
    if (!pending) {
      res.status(400).json({ message: 'No pending phone change request. Please request a new OTP.' });
      return;
    }

    // Expired check
    if (new Date() > pending.expires_at) {
      await PendingPhoneChange.updateOne({ _id: pending._id }, { status: 'expired' });
      res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
      return;
    }

    // Attempt limit check (read current value — the atomic inc below is the real guard)
    if (pending.attempts >= MAX_ATTEMPTS) {
      await PendingPhoneChange.updateOne({ _id: pending._id }, { status: 'expired' });
      res.status(429).json({ message: 'Too many incorrect attempts. Please request a new OTP.' });
      return;
    }

    // Compare OTP hash
    const isMatch = await bcrypt.compare(otp, pending.otp_hash);
    if (!isMatch) {
      // Atomic increment — prevents concurrent requests from bypassing the limit
      const updated = await PendingPhoneChange.findOneAndUpdate(
        { _id: pending._id, status: 'pending' },
        { $inc: { attempts: 1 } },
        { new: true }
      );
      if (updated && updated.attempts >= MAX_ATTEMPTS) {
        await PendingPhoneChange.updateOne({ _id: pending._id }, { status: 'expired' });
        res.status(429).json({ message: 'Too many incorrect attempts. Please request a new OTP.' });
        return;
      }
      const remaining = MAX_ATTEMPTS - (updated?.attempts || pending.attempts + 1);
      res.status(400).json({ message: `Invalid OTP. ${remaining} attempt(s) remaining.` });
      return;
    }

    // ── OTP matched — perform atomic update via transaction ──

    const user = await User.findById(userId).select('phone');
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }

    const oldPhone = user.phone || '';
    const newPhone = pending.new_phone;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Race guard: re-check availability inside transaction
        const conflict = await User.findOne({ phone: newPhone, _id: { $ne: userId } }).session(session);
        if (conflict) throw new Error('PHONE_TAKEN');

        await User.updateOne(
          { _id: userId },
          { phone: newPhone, isPhoneVerified: true },
          { session }
        );

        await PendingPhoneChange.deleteOne({ _id: pending._id }, { session });

        await PhoneChangeHistory.create(
          [{ user_id: userId, old_phone_hash: sha256(oldPhone), new_phone_hash: sha256(newPhone), changed_at: new Date() }],
          { session }
        );
      });
    } catch (txErr: any) {
      if (txErr?.message === 'PHONE_TAKEN') {
        res.status(409).json({ message: 'This phone number was just registered to another account. Please try a different number.' });
        return;
      }
      throw txErr; // re-throw for outer catch
    } finally {
      await session.endSession();
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
    const userId = req.user?._id;
    if (!userId) { res.status(401).json({ message: 'Not authenticated' }); return; }

    const todayStart = startOfTodayIST();
    const changesToday = await PhoneChangeHistory.countDocuments({ user_id: userId, changed_at: { $gte: todayStart } });

    res.json({ available: changesToday < MAX_DAILY_CHANGES, changes_today: changesToday, max_changes: MAX_DAILY_CHANGES });
  } catch (err: any) {
    console.error('[PHONE_CHANGE] getStatus error:', err?.message);
    res.status(500).json({ message: 'Failed to fetch phone change status' });
  }
};
