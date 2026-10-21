import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { UserRepository } from '../../repositories/userRepository';
import { AdminRepository } from '../../repositories/adminRepository';
import { OtpRepository } from '../../repositories/otpRepository';
import { sendProviderNotification } from '../../utils/internalApi';
import bcrypt from 'bcryptjs';

// @desc    Get current logged-in user profile
// @route   GET /api/users/me
// @access  Private
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const isAdmin = req.user?.subject_type === 'admin' || req.user?.role === 'admin' || req.user?.role === 'super_admin';
    let user: any = null;
    if (isAdmin) {
      user = await AdminRepository.findById(userId);
      if (user) {
        user.role = 'admin';
      }
    }
    if (!user) {
      user = await UserRepository.findById(userId);
    }

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const { password, password_hash, totp_secret, two_factor_recovery, ...safeUser } = user as any;
    res.json(safeUser);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update current logged-in user profile
// @route   PUT /api/users/me
// @access  Private
export const updateMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }
    const user = await UserRepository.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const oldEmail = user.email;
    const oldPhone = user.phone;
    let passwordChanged = false;
    const updates: Record<string, any> = {};

    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.email !== undefined) updates.email = req.body.email;
    if (req.body.phone !== undefined) updates.phone = req.body.phone;
    if (req.body.profile_image !== undefined) updates.profile_image = req.body.profile_image;
    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.gender !== undefined) updates.gender = req.body.gender;
    if (req.body.date_of_birth !== undefined) updates.date_of_birth = req.body.date_of_birth;
    if (req.body.anniversary !== undefined) updates.anniversary = req.body.anniversary;

    if (req.body.newPassword) {
      const { currentPassword } = req.body;
      if (!currentPassword) {
        res.status(400).json({ message: 'Current password is required to change password.' });
        return;
      }

      if (user.password_hash) {
        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
          res.status(400).json({ message: 'Incorrect current password.' });
          return;
        }
      }

      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(req.body.newPassword, salt);
      passwordChanged = true;
    } else if (req.body.password) {
      const { otp } = req.body;
      if (!otp) {
        res.status(400).json({ message: 'OTP is required to change password. Please verify your email first.' });
        return;
      }

      if (!user.email) {
        res.status(400).json({ message: 'User does not have an email registered.' });
        return;
      }

      const otpRecord = await OtpRepository.findActive(user.email, 'PASSWORD_RESET');
      if (!otpRecord) {
        res.status(400).json({ message: 'Invalid or expired OTP.' });
        return;
      }

      await OtpRepository.consume(otpRecord.id);

      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(req.body.password, salt);
      passwordChanged = true;
    }

    const updated = await UserRepository.update(userId, updates);
    if (!updated) {
      res.status(500).json({ message: 'Failed to update profile' });
      return;
    }

    if (updated.role === 'provider') {
      const userIdStr = updated.id.toString();
      if (passwordChanged) {
        sendProviderNotification(userIdStr, 'Password Changed', 'Your account password was updated successfully.', 'system_alert')
          .catch(err => console.error('[NOTIFICATION] Failed to send password changed notification:', err));
      }
      if ((req.body.email && req.body.email !== oldEmail) || (req.body.phone && req.body.phone !== oldPhone)) {
        sendProviderNotification(userIdStr, 'Account Contact Info Updated', 'Your email address or phone number has been updated successfully.', 'system_alert')
          .catch(err => console.error('[NOTIFICATION] Failed to send contact info updated notification:', err));
      }
    }

    res.json({
      _id: updated.id,
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      gender: updated.gender,
      role: updated.role,
      profile_image: updated.profile_image,
      status: updated.status,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Check email/phone availability for profile update (pre-OTP check)
// @route   POST /api/users/check-availability
// @access  Private
export const checkAvailability = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentUserId = req.user?.id || req.user?._id;
    if (!currentUserId) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const { email, phone } = req.body;
    const errors: { email?: string; phone?: string } = {};

    if (email) {
      const existing = await UserRepository.findByEmail(email);
      if (existing && existing.id !== currentUserId && existing.legacy_mongo_id !== currentUserId) {
        errors.email = 'This email address is already registered with another account.';
      }
    }

    if (phone) {
      const existing = await UserRepository.findByPhone(phone);
      if (existing && existing.id !== currentUserId && existing.legacy_mongo_id !== currentUserId) {
        errors.phone = 'This phone number is already registered with another account.';
      }
    }

    if (Object.keys(errors).length > 0) {
      res.status(400).json({ errors });
      return;
    }

    res.status(200).json({ available: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
