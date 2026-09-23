import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { UserRepository } from '../../repositories/userRepository';
import { RefreshTokenRepository } from '../../repositories/refreshTokenRepository';
import crypto from 'crypto';

// @desc    Get active sessions for user
// @route   GET /api/users/sessions
// @access  Private
export const getSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const sessions = await RefreshTokenRepository.getActiveSessions(userId);

    // Identify current session
    const currentToken = req.cookies?.jwt;
    let currentHash = '';
    if (currentToken) {
      currentHash = crypto.createHash('sha256').update(currentToken).digest('hex');
    }

    const mappedSessions = sessions.map((s: any) => {
      const isCurrent = currentHash === s.token_hash;
      return {
        _id: s.id,
        id: s.id,
        device_info: s.device_info,
        ip_address: s.ip_address,
        createdAt: s.created_at,
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
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const deleted = await RefreshTokenRepository.deleteSessionById(req.params.sessionId, userId);
    if (!deleted) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }

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
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    await RefreshTokenRepository.deleteAllForUser(userId);
    
    // Increment tokenVersion to invalidate access tokens globally
    await UserRepository.incrementTokenVersion(userId);

    res.cookie('jwt', '', {
      httpOnly: true,
      expires: new Date(0)
    });
    res.json({ message: 'Successfully logged out of all devices' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
