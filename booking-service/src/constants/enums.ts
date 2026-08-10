export enum BookingStatus {
  PENDING = 'pending',
  PROVIDER_SEARCHING = 'provider_searching',
  ACCEPTED = 'accepted',
  ON_THE_WAY = 'on_the_way',
  ARRIVED = 'arrived',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  UNASSIGNED_TIMEOUT = 'unassigned_timeout',
  WAITING_START_OTP = 'waiting_start_otp',
  WAITING_END_OTP = 'waiting_end_otp',
  SERVICE_COMPLETED = 'service_completed',
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  PAID = 'paid',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}
