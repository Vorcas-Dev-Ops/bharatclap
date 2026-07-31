 import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { User, IUser } from '../../models/User';
import { Otp } from '../../models/Otp';
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
    const user = await User.findById(req.user?._id).select('-password');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update current logged-in user profile
// @route   PUT /api/users/me
// @access  Private
export const updateMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id) as IUser & { _id: string; password?: string };
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const oldEmail = user.email;
    const oldPhone = user.phone;
    let passwordChanged = false;

    user.name = req.body.name ?? user.name;
    user.email = req.body.email ?? user.email;
    user.phone = req.body.phone ?? user.phone;
    user.profile_image = req.body.profile_image ?? user.profile_image;
    user.gender = req.body.gender ?? user.gender;

    if (req.body.newPassword) {
      const { currentPassword } = req.body;
      if (!currentPassword) {
        res.status(400).json({ message: 'Current password is required to change password.' });
        return;
      }

      if (user.password) {
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
          res.status(400).json({ message: 'Incorrect current password.' });
          return;
        }
      }

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.newPassword, salt);
      passwordChanged = true;
    } else if (req.body.password) {
      const { otp } = req.body;
      if (!otp) {
        res.status(400).json({ message: 'OTP is required to change password. Please verify your email first.' });
        return;
      }

      const otpRecord = await Otp.findOne({ identifier: user.email, otpCode: otp });
      if (!otpRecord) {
        res.status(400).json({ message: 'Invalid or expired OTP.' });
        return;
      }

      await Otp.deleteOne({ _id: otpRecord._id });

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
      passwordChanged = true;
    }

    const updated = await user.save();

    if (updated.role === 'provider') {
      const userIdStr = updated._id.toString();
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
      _id: updated._id,
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
    const currentUserId = req.user?._id;
    if (!currentUserId) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const { email, phone } = req.body;
    const errors: { email?: string; phone?: string } = {};

    if (email) {
      const emailTaken = await User.findOne({ email: email.trim().toLowerCase(), _id: { $ne: currentUserId } });
      if (emailTaken) {
        errors.email = 'This email address is already registered with another account.';
      }
    }

    if (phone) {
      const phoneTaken = await User.findOne({ phone: phone.trim(), _id: { $ne: currentUserId } });
      if (phoneTaken) {
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
