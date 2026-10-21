import { CampaignRepository } from '../repositories/campaignRepository';
import { dispatchCampaignToEcosystem } from '../controllers/campaignController';

export function startScheduledCampaignCron() {
  console.log('⏰ [CRON WORKER] Starting Scheduled Campaign Automated Dispatch Cron...');

  const processScheduledCampaigns = async () => {
    try {
      // Concurrency safe: SELECT ... FOR UPDATE SKIP LOCKED claims campaigns atomically
      const dueCampaigns = await CampaignRepository.claimDueScheduledCampaigns();
      if (!dueCampaigns || dueCampaigns.length === 0) return;

      console.log(`⏰ [CRON WORKER] Processing ${dueCampaigns.length} scheduled campaign(s)...`);

      for (const campaign of dueCampaigns) {
        try {
          console.log(`🚀 [CRON WORKER] Dispatching scheduled campaign "${campaign.title}" (${campaign.id})`);
          await dispatchCampaignToEcosystem(campaign);
          await CampaignRepository.updateCampaign(campaign.id, {
            status: 'sent',
            sent_at: new Date(),
          });
          await CampaignRepository.syncCampaignCounters(campaign.id);
          console.log(`✅ [CRON WORKER] Scheduled campaign "${campaign.title}" sent successfully`);
        } catch (err: any) {
          console.error(`❌ [CRON WORKER] Failed to dispatch scheduled campaign ${campaign.id}:`, err.message);
          await CampaignRepository.updateCampaign(campaign.id, {
            status: 'failed',
          });
        }
      }
    } catch (err: any) {
      console.error('[CRON WORKER] Error processing scheduled campaigns:', err.message);
    }
  };

  // Run on startup then check every 15 seconds
  processScheduledCampaigns();
  setInterval(processScheduledCampaigns, 15000);
}
