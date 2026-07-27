import { Provider } from '../models/Provider';
import { SubscriptionAuditLog } from '../models/SubscriptionAuditLog';
import { sendProviderNotification } from './internalApi';

/**
 * Subscription management audit running daily.
 * Handles expiration notifications, transition to 7-day grace period, and auto-fallback to wallet_based model.
 */
export const runSubscriptionCronJob = async () => {
  const auditSubscriptions = async () => {
    try {
      const now = new Date();

      // 1. Process active free access providers whose end date has passed -> Move to Grace Period
      const expiredAccessProviders = await Provider.find({
        isFreeAccessEnabled: true,
        freeAccessEndDate: { $ne: null, $lte: now },
        subscriptionStatus: { $in: ['active', 'expiring'] }
      });

      for (const provider of expiredAccessProviders) {
        const gracePeriodEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 Days grace period
        const prevState = {
          subscriptionStatus: provider.subscriptionStatus,
          isFreeAccessEnabled: provider.isFreeAccessEnabled,
          freeAccessEndDate: provider.freeAccessEndDate,
        };

        provider.subscriptionStatus = 'grace_period';
        provider.gracePeriodEndDate = gracePeriodEnd;
        await provider.save();

        await SubscriptionAuditLog.create({
          providerId: provider._id,
          action: 'enter_grace_period',
          performedBy: 'System',
          reason: 'Free Access duration ended — 7-day Grace Period initiated',
          previousState: prevState,
          newState: {
            subscriptionStatus: provider.subscriptionStatus,
            gracePeriodEndDate: provider.gracePeriodEndDate
          }
        });

        await sendProviderNotification(
          provider.user_id.toString(),
          'Free Access Ended — Grace Period Active',
          'Your Free Access period has ended. You have entered a 7-day Grace Period. Please fund your wallet to continue receiving jobs without interruption after the grace period.',
          'subscription_grace_period'
        );
      }

      // 2. Process providers whose Grace Period has ended -> Revert to wallet_based & expired
      const expiredGraceProviders = await Provider.find({
        isFreeAccessEnabled: true,
        gracePeriodEndDate: { $ne: null, $lte: now },
        subscriptionStatus: 'grace_period'
      });

      for (const provider of expiredGraceProviders) {
        const prevState = {
          subscriptionType: provider.subscriptionType,
          subscriptionStatus: provider.subscriptionStatus,
          isFreeAccessEnabled: provider.isFreeAccessEnabled,
        };

        provider.isFreeAccessEnabled = false;
        provider.subscriptionType = 'wallet_based';
        provider.subscriptionStatus = 'expired';
        await provider.save();

        await SubscriptionAuditLog.create({
          providerId: provider._id,
          action: 'auto_expire',
          performedBy: 'System',
          reason: '7-day Grace Period ended — Reverted to Wallet-Based subscription model',
          previousState: prevState,
          newState: {
            subscriptionType: provider.subscriptionType,
            subscriptionStatus: provider.subscriptionStatus,
            isFreeAccessEnabled: provider.isFreeAccessEnabled
          }
        });

        await sendProviderNotification(
          provider.user_id.toString(),
          'Subscription Reverted to Wallet-Based',
          'Your Grace Period has ended. Your account has automatically reverted to the Wallet-Based model. Ensure your wallet maintains the minimum required balance to receive client requests.',
          'subscription_expired'
        );
      }

      // 3. Expiration Reminders (7 days, 3 days, 1 day prior)
      const activeWithEndDate = await Provider.find({
        isFreeAccessEnabled: true,
        freeAccessEndDate: { $ne: null, $gt: now },
        subscriptionStatus: { $in: ['active', 'expiring'] }
      });

      for (const provider of activeWithEndDate) {
        if (!provider.freeAccessEndDate) continue;
        const diffMs = provider.freeAccessEndDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 7 || diffDays === 3 || diffDays === 1) {
          if (diffDays <= 3 && provider.subscriptionStatus !== 'expiring') {
            provider.subscriptionStatus = 'expiring';
            await provider.save();
          }

          await sendProviderNotification(
            provider.user_id.toString(),
            `Free Access Expiring in ${diffDays} Day${diffDays > 1 ? 's' : ''}`,
            `Your Free Access period will expire on ${provider.freeAccessEndDate.toLocaleDateString()}. Make sure your wallet is funded to continue taking client bookings.`,
            'subscription_expiring_soon'
          );
        }
      }
    } catch (err: any) {
      console.error('[SUBSCRIPTION CRON ERROR]', err.message);
    }
  };

  // Run on startup, then every 24 hours
  setTimeout(auditSubscriptions, 15000); // 15s delay after startup
  setInterval(auditSubscriptions, 24 * 60 * 60 * 1000);
};
