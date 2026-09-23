import { getDb } from '../config/db';

let cached: {
  acceptanceSec: number;
  maxAttempts: number;
  tier1Count: number;
  tier1Timeout: number;
  tier2Count: number;
  tier2Timeout: number;
  radiusExpansionKm: number;
  maxRadiusKm: number;
} | null = null;
let cacheTime = 0;

export async function getDispatchConfig() {
  if (cached && Date.now() - cacheTime < 60_000) return cached;
  let s: any = null;
  try {
    const res = await getDb().query('SELECT settings FROM provider.dispatch_settings LIMIT 1');
    s = res.rows[0]?.settings ?? null;
  } catch (_) {
    s = null;
  }

  cached = {
    acceptanceSec: s?.acceptanceTimeoutSeconds ?? 600,
    maxAttempts:   s?.maxRedispatchAttempts ?? 3,
    tier1Count:    s?.tier1ProviderCount ?? 5,
    tier1Timeout:  s?.tier1TimeoutSeconds ?? 90,
    tier2Count:    s?.tier2ProviderCount ?? 10,
    tier2Timeout:  s?.tier2TimeoutSeconds ?? 90,
    radiusExpansionKm: s?.radiusExpansionKm ?? 5,
    maxRadiusKm:   s?.maxDispatchRadiusKm ?? 30,
  };
  cacheTime = Date.now();
  return cached;
}

/**
 * Per-provider request expiry, capped at overall booking expiry.
 * Prevents individual request from outliving the booking.
 */
export function calcJobRequestExpiry(
  bookingSearchExpiresAt: Date,
  acceptanceTimeoutSec: number
): Date {
  const individual = new Date(Date.now() + acceptanceTimeoutSec * 1000);
  return individual < bookingSearchExpiresAt ? individual : bookingSearchExpiresAt;
}
