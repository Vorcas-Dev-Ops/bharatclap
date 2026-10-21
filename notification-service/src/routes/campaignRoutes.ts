import express from 'express';
import {
  createCampaign,
  sendTestNotification,
  getCampaigns,
  getScheduledCampaigns,
  sendCampaignNow,
  estimateAudience,
  getTestTargets,
  updateCampaign,
  deleteCampaign,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  trackNotificationOpen,
  registerDeviceToken,
} from '../controllers/campaignController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// Mobile Apps Analytics & Device Registration (Customer & Partner apps)
router.post('/track-open', trackNotificationOpen);
router.post('/register-token', protect, registerDeviceToken);

// All campaign operations are protected & admin-accessible
router.use(['/campaigns', '/templates', '/test-targets', '/send-test'], protect, admin);

// Campaigns
router.get('/campaigns', getCampaigns);
router.get('/campaigns/scheduled', getScheduledCampaigns);
router.post('/campaigns', createCampaign);
router.post('/campaigns/test', sendTestNotification);
router.post('/send-test', sendTestNotification);
router.get('/campaigns/estimate', estimateAudience);
router.post('/campaigns/estimate', estimateAudience);
router.post('/campaigns/:id/send-now', sendCampaignNow);
router.put('/campaigns/:id', updateCampaign);
router.delete('/campaigns/:id', deleteCampaign);

// Test targets
router.get('/test-targets', getTestTargets);

// Templates
router.get('/templates', getTemplates);
router.post('/templates', createTemplate);
router.put('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);

export default router;
