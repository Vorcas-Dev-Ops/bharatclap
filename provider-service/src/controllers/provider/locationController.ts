import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { Provider } from '../../models/Provider';

// @desc    Update provider live location
// @route   PATCH /api/providers/live-location
// @access  Private/Provider
export const updateLiveLocation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { latitude, longitude } = req.body;
    const provider = await Provider.findOneAndUpdate(
      { user_id: req.user?._id },
      {
        live_location: { type: 'Point', coordinates: [longitude, latitude] },
        lastActiveAt: new Date(),
        isOnline: true
      },
      { new: true }
    );
    res.json({ message: 'Live location updated', location: provider?.live_location });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
