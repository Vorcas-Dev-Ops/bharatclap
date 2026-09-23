import { AccountDeletionRepository } from '../repositories/accountDeletionRepository';
import { UserRepository } from '../repositories/userRepository';
import axios from 'axios';

const MAX_ATTEMPTS = 5;

export const processDeletionOutboxBatch = async (): Promise<number> => {
  const pendingOutboxEvents = await AccountDeletionRepository.findPendingOutbox(10);

  if (!pendingOutboxEvents || pendingOutboxEvents.length === 0) {
    return 0;
  }

  let processedCount = 0;

  for (const outboxItem of pendingOutboxEvents) {
    const attempts = outboxItem.attempts + 1;

    try {
      // 1. Double Obligation Validation
      const accountType = (outboxItem.payload?.account_type as 'CUSTOMER' | 'PROVIDER') || 'CUSTOMER';
      const obligations = await checkUserObligations(String(outboxItem.user_id), accountType);

      if (obligations.length > 0) {
        await AccountDeletionRepository.updateOutboxStatus(outboxItem.id, 'PUBLISHED', attempts);
        continue;
      }

      // 2. Anonymize user in auth.users
      const targetUser = await UserRepository.findById(outboxItem.user_id);
      if (targetUser) {
        await UserRepository.update(targetUser.id, {
          name: `DELETED_USER_${targetUser.id.slice(-6)}`,
          email: null,
          phone: null,
          profile_image: '',
          deleted_at: new Date(),
          is_anonymized: true,
          status: 'blocked',
          token_version: (targetUser.token_version || 0) + 100,
        });
      }

      // 3. Mark outbox item completed/published
      await AccountDeletionRepository.updateOutboxStatus(outboxItem.id, 'PUBLISHED', attempts);
      processedCount++;
    } catch (err: any) {
      console.error(`[DELETION WORKER ERROR] Outbox item ${outboxItem.id} attempt ${attempts} failed:`, err?.message || err);

      if (attempts >= MAX_ATTEMPTS) {
        await AccountDeletionRepository.updateOutboxStatus(outboxItem.id, 'DLQ', attempts);
      } else {
        await AccountDeletionRepository.updateOutboxStatus(outboxItem.id, 'PENDING', attempts);
      }
    }
  }

  return processedCount;
};

// Helper: Microservice Obligation Pre-check
export const checkUserObligations = async (userId: string, accountType: 'CUSTOMER' | 'PROVIDER'): Promise<string[]> => {
  const obligations: string[] = [];

  try {
    const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://127.0.0.1:5004';
    const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL || 'http://127.0.0.1:5005';

    if (accountType === 'CUSTOMER') {
      const bookingRes = await axios.get(`${BOOKING_URL}/api/bookings/internal/active-count?userId=${userId}`).catch(() => ({ data: { count: 0 } }));
      if (bookingRes.data?.count > 0) {
        obligations.push('You have active or pending service bookings. Please complete or cancel them before deleting your account.');
      }
    } else if (accountType === 'PROVIDER') {
      const jobRes = await axios.get(`${BOOKING_URL}/api/bookings/internal/provider-active-count?providerId=${userId}`).catch(() => ({ data: { count: 0 } }));
      if (jobRes.data?.count > 0) {
        obligations.push('You have assigned or in-progress provider jobs. Please complete or reassign them first.');
      }

      const codRes = await axios.get(`${PAYMENT_URL}/api/payments/internal/provider-cod-pending?providerId=${userId}`).catch(() => ({ data: { pendingAmount: 0 } }));
      if (codRes.data?.pendingAmount > 0) {
        obligations.push('You have un-remitted Cash on Delivery (COD) collections. Please submit pending remittances first.');
      }
    }
  } catch (err) {
    console.warn('[OBLIGATION CHECK WARNING] Microservice pre-check error:', err);
  }

  return obligations;
};
