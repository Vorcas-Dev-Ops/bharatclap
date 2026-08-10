import { User } from '../models/User';
import { logger } from '@bharatclap/shared';

export const runAccountDeletionCron = async (): Promise<void> => {
  try {
    const now = new Date();

    // Find users whose 30-day deletion cooling period has expired and have not yet been anonymized
    const usersToAnonymize = await User.find({
      deletion_scheduled_at: { $lte: now },
      is_anonymized: { $ne: true }
    }).limit(100);

    if (usersToAnonymize.length === 0) {
      return;
    }

    logger.info(`DPDPA account deletion cron found ${usersToAnonymize.length} accounts to anonymize`, {
      service: 'auth-service',
      action: 'DPDPA_DELETION_CRON_START'
    });

    for (const user of usersToAnonymize) {
      try {
        const anonymizedId = user._id.toString();

        user.name = `Deleted User (${anonymizedId.slice(-4)})`;
        (user as any).email = undefined;
        (user as any).phone = undefined;
        user.profile_image = '';
        user.googleId = undefined;
        user.isDeleted = true;
        user.is_anonymized = true;
        user.status = 'blocked';
        user.tokenVersion += 1; // Invalidate all existing JWT sessions

        await user.save();

        logger.info(`User PII successfully anonymized for user ${anonymizedId}`, {
          service: 'auth-service',
          action: 'DPDPA_USER_ANONYMIZED',
          userId: anonymizedId
        });
      } catch (err: any) {
        logger.error(`Failed to anonymize user ${user._id}`, err);
      }
    }
  } catch (err: any) {
    logger.error('DPDPA account deletion cron error', err);
  }
};
