import { EventEmitter } from 'events';

class SystemEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }
}

export const eventBus = new SystemEventBus();

export const SYSTEM_EVENTS = {
  BOOKING_COMPLETED: 'BOOKING_COMPLETED',
  KYC_APPROVED: 'KYC_APPROVED',
  STARTER_KIT_COMPLETED: 'STARTER_KIT_COMPLETED',
  REFERRAL_QUALIFIED: 'REFERRAL_QUALIFIED',
  REFERRAL_REWARDED: 'REFERRAL_REWARDED',
};
