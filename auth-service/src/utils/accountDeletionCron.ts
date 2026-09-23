import { getDb } from '../config/db';
import { logger } from '@bharatclap/shared';

export const runAccountDeletionCron = async (): Promise<void> => {
  try {
    const pool = getDb();
    // Find and anonymize users whose 30-day deletion cooling period has expired
    const res = await pool.query(
      `UPDATE auth.users
       SET name = 'Deleted User (' || RIGHT(id::text, 4) || ')',
           email = NULL,
           phone = NULL,
           profile_image = '',
           google_id = NULL,
           deleted_at = NOW(),
           is_anonymized = TRUE,
           status = 'blocked',
           token_version = token_version + 1,
           updated_at = NOW()
       WHERE deletion_scheduled_at <= NOW()
         AND is_anonymized = FALSE
       RETURNING id`
    );

    if (res.rowCount && res.rowCount > 0) {
      logger.info(`DPDPA account deletion cron anonymized ${res.rowCount} accounts`, {
        service: 'auth-service',
        action: 'DPDPA_USER_ANONYMIZED',
        count: res.rowCount,
      });
    }
  } catch (err: any) {
    logger.error('DPDPA account deletion cron error', err);
  }
};
