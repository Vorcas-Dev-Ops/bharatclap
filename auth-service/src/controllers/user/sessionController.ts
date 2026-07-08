import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { User } from '../../models/User';
import { RefreshToken } from '../../models/RefreshToken';
import crypto from 'crypto';

// @desc    Get active sessions for user
// @route   GET /api/users/sessions
// @access  Private
export const getSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessions = await RefreshToken.find({ user_id: req.user?._id, revoked: false })
      .select('device_info ip_address createdAt expires_at token_hash')
      .sort({ createdAt: -1 })
      .lean();

    // Identify current session
    const currentToken = req.cookies?.jwt;
    let currentHash = '';
    if (currentToken) {
      currentHash = crypto.createHash('sha256').update(currentToken).digest('hex');
    }

    const mappedSessions = sessions.map((s: any) => {
      const isCurrent = currentHash === s.token_hash;
      return {
        _id: s._id,
        device_info: s.device_info,
        ip_address: s.ip_address,
        createdAt: s.createdAt,
        expires_at: s.expires_at,
        is_current: isCurrent
      };
    });

    res.json(mappedSessions);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Logout specific device
// @route   DELETE /api/users/sessions/:sessionId
// @access  Private
export const logoutDevice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const session = await RefreshToken.findOne({ _id: req.params.sessionId, user_id: req.user?._id });
    if (!session) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }

    await RefreshToken.deleteOne({ _id: session._id });
    res.json({ message: 'Device logged out successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Logout all devices
// @route   DELETE /api/users/sessions
// @access  Private
export const logoutAllDevices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await RefreshToken.deleteMany({ user_id: req.user?._id });
    
    // Increment tokenVersion to invalidate access tokens globally
    await User.findByIdAndUpdate(req.user?._id, { $inc: { tokenVersion: 1 } });

    res.cookie('jwt', '', {
      httpOnly: true,
      expires: new Date(0)
    });
    res.json({ message: 'Successfully logged out of all devices' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
