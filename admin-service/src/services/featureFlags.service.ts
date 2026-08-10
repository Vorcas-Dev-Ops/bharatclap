import { CacheService } from '../cache/cache.service';

export class FeatureFlagsService {
  private static CACHE_KEY = 'admin:cache:feature_flags';
  private static TTL = 30; // 30 seconds

  static async getFeatureFlags() {
    const cached = await CacheService.get(this.CACHE_KEY);
    if (cached) return cached;

    const flags = [
      { id: '1', key: 'referral_system', name: 'Referral System', enabled: true, category: 'marketing' },
      { id: '2', key: 'memberships', name: 'Membership Subscriptions', enabled: true, category: 'core' },
      { id: '3', key: 'wallet', name: 'Customer Wallet', enabled: true, category: 'payments' },
      { id: '4', key: 'cod_payments', name: 'Cash On Delivery (COD)', enabled: true, category: 'payments' },
      { id: '5', key: 'coupons', name: 'Coupons & Discounts', enabled: true, category: 'marketing' },
      { id: '6', key: 'fcm_notifications', name: 'Push Notifications (FCM)', enabled: true, category: 'system' },
      { id: '7', key: 'sms_alerts', name: 'SMS Alerts (DLT)', enabled: true, category: 'system' },
      { id: '8', key: 'maintenance_mode', name: 'Global Maintenance Mode', enabled: false, category: 'system' },
    ];

    await CacheService.set(this.CACHE_KEY, flags, this.TTL);
    return flags;
  }

  static async toggleFeatureFlag(key: string, enabled: boolean) {
    const flags = await this.getFeatureFlags();
    const updated = (flags as any[]).map((f: any) => f.key === key ? { ...f, enabled } : f);
    await CacheService.set(this.CACHE_KEY, updated, this.TTL);
    return updated;
  }
}
