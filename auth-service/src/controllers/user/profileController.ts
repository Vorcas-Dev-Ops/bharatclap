import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { User, IUser } from '../../models/User';
import { Otp } from '../../models/Otp';
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

    user.name = req.body.name ?? user.name;
    user.email = req.body.email ?? user.email;
    user.phone = req.body.phone ?? user.phone;
    user.profile_image = req.body.profile_image ?? user.profile_image;
    user.gender = req.body.gender ?? user.gender;

    if (req.body.password) {
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
    }

    const updated = await user.save();

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
