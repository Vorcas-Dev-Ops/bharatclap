import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import {
  getProviderReferralDashboard,
  registerProviderReferral,
  evaluateAndProcessFirstJobReward,
  getAdminCampaignsList,
  createAdminCampaign,
  updateAdminCampaign,
  duplicateAdminCampaign,
  getAdminReferralAnalytics,
  getAdminReferralsListPaginated,
  processFraudReviewDecision,
} from '../../services/providerReferralService';

/**
 * Provider Referral Dashboard (Code, Link, Stats, Leaderboard, History)
 */
export const getReferralDashboardController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const providerId = req.user?._id;
    if (!providerId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const data = await getProviderReferralDashboard(String(providerId));
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Apply Referral Code on Registration
 */
export const applyReferralCodeController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const providerId = req.user?._id;
    const { referralCode } = req.body;

    if (!providerId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const result = await registerProviderReferral(String(providerId), referralCode);
    if (!result.success) {
      res.status(400).json({ message: result.message });
      return;
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Internal API to trigger job reward evaluation
 */
export const triggerFirstJobRewardController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { providerId, bookingId, completedJobsCount } = req.body;

    if (!providerId || !bookingId) {
      res.status(400).json({ message: 'providerId and bookingId are required' });
      return;
    }

    const result = await evaluateAndProcessFirstJobReward(providerId, bookingId, completedJobsCount || 1);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Admin Campaign Endpoints
 */
export const getAdminCampaignsController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const campaigns = await getAdminCampaignsList();
    res.json(campaigns);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createAdminCampaignController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const campaign = await createAdminCampaign(req.body, req.user);
    res.status(201).json(campaign);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateAdminCampaignController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const campaign = await updateAdminCampaign(req.params.id, req.body, req.user);
    res.json(campaign);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const duplicateAdminCampaignController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const copy = await duplicateAdminCampaign(req.params.id);
    res.status(201).json(copy);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Admin Referral Analytics
 */
export const getAdminReferralAnalyticsController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const analytics = await getAdminReferralAnalytics();
    res.json(analytics);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Admin Paginated Referral List
 */
export const getAdminReferralsListController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await getAdminReferralsListPaginated(req.query);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Admin Fraud Review Decision
 */
export const processFraudReviewController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action } = req.body;
    const result = await processFraudReviewDecision(req.params.id, action);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
