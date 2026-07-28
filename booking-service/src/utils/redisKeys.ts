export const RedisKeys = {
  bookingCache: (bookingId: string) => `booking:cache:${bookingId}`,
  jobRequest: (bookingId: string) => `jobrequest:${bookingId}`,
  bookingETA: (bookingId: string) => `booking:eta:${bookingId}`,
  timeoutLock: (bookingId: string) => `lock:timeout:${bookingId}`,
  policyConfig: () => `policy:config:global`,
};
