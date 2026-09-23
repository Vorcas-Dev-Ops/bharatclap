import { getDb } from '../config/db';
import { sendProviderNotification } from './internalApi';

/**
 * Subscription management audit running daily.
 * Handles expiration notifications, transition to 7-day grace period, and auto-fallback to wallet_based model.
 */
export const runSubscriptionCronJob = async () => {
  const auditSubscriptions = async () => {
    try {
      const now = new Date();
      const pool = getDb();

      // 1. Process active free access providers whose end date has passed -> Move to Grace Period
      const expiredAccessRes = await pool.query(
        `SELECT id, user_id, subscription_status, subscription_type, subscription_end_date
         FROM provider.providers
         WHERE subscription_end_date IS NOT NULL
           AND subscription_end_date <= $1
           AND subscription_status IN ('active', 'expiring')`,
        [now]
      );

      for (const provider of expiredAccessRes.rows) {
        const gracePeriodEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        await pool.query(
          `UPDATE provider.providers
           SET subscription_status = 'grace_period', grace_period_end = $1, updated_at = NOW()
           WHERE id = $2`,
          [gracePeriodEnd, provider.id]
        );

        await pool.query(
          `INSERT INTO provider.subscription_audit_logs (
             provider_id, action, old_value, new_value
           ) VALUES ($1, 'enter_grace_period', $2, $3)`,
          [
            provider.id,
            JSON.stringify({ status: provider.subscription_status }),
            JSON.stringify({ status: 'grace_period', grace_period_end: gracePeriodEnd })
          ]
        );

        if (provider.user_id) {
          await sendProviderNotification(
            String(provider.user_id),
            'Free Access Ended — Grace Period Active',
            'Your Free Access period has ended. You have entered a 7-day Grace Period. Please fund your wallet to continue receiving jobs without interruption after the grace period.',
            'subscription_grace_period'
          );
        }
      }

      // 2. Process providers whose Grace Period has ended -> Revert to wallet_based & expired
      const expiredGraceRes = await pool.query(
        `SELECT id, user_id, subscription_status, subscription_type
         FROM provider.providers
         WHERE grace_period_end IS NOT NULL
           AND grace_period_end <= $1
           AND subscription_status = 'grace_period'`,
        [now]
      );

      for (const provider of expiredGraceRes.rows) {
        await pool.query(
          `UPDATE provider.providers
           SET subscription_type = 'wallet_based', subscription_status = 'expired', updated_at = NOW()
           WHERE id = $1`,
          [provider.id]
        );

        await pool.query(
          `INSERT INTO provider.subscription_audit_logs (
             provider_id, action, old_value, new_value
           ) VALUES ($1, 'auto_expire', $2, $3)`,
          [
            provider.id,
            JSON.stringify({ subscription_type: provider.subscription_type, status: provider.subscription_status }),
            JSON.stringify({ subscription_type: 'wallet_based', status: 'expired' })
          ]
        );

        if (provider.user_id) {
          await sendProviderNotification(
            String(provider.user_id),
            'Subscription Reverted to Wallet-Based',
            'Your Grace Period has ended. Your account has automatically reverted to the Wallet-Based model. Ensure your wallet maintains the minimum required balance to receive client requests.',
            'subscription_expired'
          );
        }
      }
    } catch (err: any) {
      console.error('[SUBSCRIPTION CRON ERROR]', err.message);
    }
  };

  setTimeout(auditSubscriptions, 15000);
  setInterval(auditSubscriptions, 24 * 60 * 60 * 1000);
};
