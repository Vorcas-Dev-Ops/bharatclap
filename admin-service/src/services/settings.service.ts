import { CacheService } from '../cache/cache.service';

export interface LegalDocMeta {
  documentId: string;
  version: string;
  effectiveDate: string;
  lastUpdated: string;
  status: 'Draft' | 'Published' | 'Archived';
}

export interface PublicSettings {
  companyName: string;
  platformName: string;
  supportEmail: string;
  businessEmail: string;
  supportPhone: string;
  companyAddress: string;
  workingHours: string;
  gstNumber: string;
  appVersion: string;
  buildNumber: string;
  emergencyContact: string;
  socialLinks: {
    facebook: string;
    twitter: string;
    instagram: string;
    linkedin: string;
    youtube: string;
  };
  supportStatusMode: 'auto' | 'manual';
  manualSupportStatus: 'Open' | 'Busy' | 'Closed' | 'Holiday';
  policiesVersion: string;
  lastUpdated: string;
  legalDocuments: Record<string, LegalDocMeta>;
}

export class SettingsService {
  private static CACHE_KEY = 'admin:cache:settings';
  private static TTL = 600; // 10 minutes

  static async getPlatformSettings(): Promise<any> {
    const cached: any = await CacheService.get(this.CACHE_KEY);
    if (cached) return cached;

    const defaultLegalDocs: Record<string, LegalDocMeta> = {
      privacy: { documentId: 'DOC-PRIV-2026-V2.4', version: '2.4', effectiveDate: '2026-08-08', lastUpdated: '2026-08-08', status: 'Published' },
      terms: { documentId: 'DOC-TRMS-2026-V2.4', version: '2.4', effectiveDate: '2026-08-08', lastUpdated: '2026-08-08', status: 'Published' },
      refunds: { documentId: 'DOC-RFND-2026-V2.4', version: '2.4', effectiveDate: '2026-08-08', lastUpdated: '2026-08-08', status: 'Published' },
      cookies: { documentId: 'DOC-COOK-2026-V1.2', version: '1.2', effectiveDate: '2026-08-08', lastUpdated: '2026-08-08', status: 'Published' },
      community: { documentId: 'DOC-COMM-2026-V2.0', version: '2.0', effectiveDate: '2026-08-08', lastUpdated: '2026-08-08', status: 'Published' },
      provider: { documentId: 'DOC-PROV-2026-V2.4', version: '2.4', effectiveDate: '2026-08-08', lastUpdated: '2026-08-08', status: 'Published' },
    };

    const settings = {
      platformName: 'BharatClap',
      companyName: 'BharatClap Technologies Private Limited',
      supportEmail: 'support@bharatclap.in',
      businessEmail: 'business@bharatclap.in',
      supportPhone: '+91 80 4567 8900',
      companyAddress: 'BharatClap Tech Park, 4th Floor, 100ft Road, Indiranagar, Bengaluru, KA 560038',
      workingHours: 'Monday – Sunday | 8:00 AM – 10:00 PM IST',
      gstNumber: '29ABCDE1234F1Z5',
      appVersion: '1.0.0',
      buildNumber: '20260808.1',
      emergencyContact: '+91 80 4567 8900 (Option 9)',
      currency: 'INR',
      socialLinks: {
        facebook: 'https://facebook.com/bharatclap',
        twitter: 'https://twitter.com/bharatclap',
        instagram: 'https://instagram.com/bharatclap',
        linkedin: 'https://linkedin.com/company/bharatclap',
        youtube: 'https://youtube.com/c/bharatclap',
      },
      supportStatusMode: 'auto',
      manualSupportStatus: 'Open',
      policiesVersion: 'v2.4',
      lastUpdated: 'August 8, 2026',
      legalDocuments: defaultLegalDocs,
      razorpay: { enabled: true, mode: 'live', keyId: 'rzp_live_••••••••' },
      msg91: { enabled: true, senderId: 'BHTCLP', dltApproved: true },
      smtp: { enabled: true, host: 'smtp.gmail.com', port: 587, sender: 'noreply@bharatclap.in' },
      firebase: { enabled: true, projectId: 'bharatclap-prod-fcm' },
    };

    await CacheService.set(this.CACHE_KEY, settings, this.TTL);
    return settings;
  }

  static async getPublicSettings(): Promise<PublicSettings> {
    const settings: any = await this.getPlatformSettings();
    return {
      companyName: settings.companyName || 'BharatClap Technologies Private Limited',
      platformName: settings.platformName || 'BharatClap',
      supportEmail: settings.supportEmail || 'support@bharatclap.in',
      businessEmail: settings.businessEmail || 'business@bharatclap.in',
      supportPhone: settings.supportPhone || '+91 80 4567 8900',
      companyAddress: settings.companyAddress || 'BharatClap Tech Park, Indiranagar, Bengaluru, KA 560038',
      workingHours: settings.workingHours || 'Monday – Sunday | 8:00 AM – 10:00 PM IST',
      gstNumber: settings.gstNumber || '29ABCDE1234F1Z5',
      appVersion: settings.appVersion || '1.0.0',
      buildNumber: settings.buildNumber || '20260808.1',
      emergencyContact: settings.emergencyContact || '+91 80 4567 8900 (Option 9)',
      socialLinks: settings.socialLinks || {
        facebook: 'https://facebook.com/bharatclap',
        twitter: 'https://twitter.com/bharatclap',
        instagram: 'https://instagram.com/bharatclap',
        linkedin: 'https://linkedin.com/company/bharatclap',
        youtube: 'https://youtube.com/c/bharatclap',
      },
      supportStatusMode: settings.supportStatusMode || 'auto',
      manualSupportStatus: settings.manualSupportStatus || 'Open',
      policiesVersion: settings.policiesVersion || 'v2.4',
      lastUpdated: settings.lastUpdated || 'August 8, 2026',
      legalDocuments: settings.legalDocuments || {
        privacy: { documentId: 'DOC-PRIV-2026-V2.4', version: '2.4', effectiveDate: '2026-08-08', lastUpdated: '2026-08-08', status: 'Published' },
        terms: { documentId: 'DOC-TRMS-2026-V2.4', version: '2.4', effectiveDate: '2026-08-08', lastUpdated: '2026-08-08', status: 'Published' },
        refunds: { documentId: 'DOC-RFND-2026-V2.4', version: '2.4', effectiveDate: '2026-08-08', lastUpdated: '2026-08-08', status: 'Published' },
        cookies: { documentId: 'DOC-COOK-2026-V1.2', version: '1.2', effectiveDate: '2026-08-08', lastUpdated: '2026-08-08', status: 'Published' },
        community: { documentId: 'DOC-COMM-2026-V2.0', version: '2.0', effectiveDate: '2026-08-08', lastUpdated: '2026-08-08', status: 'Published' },
        provider: { documentId: 'DOC-PROV-2026-V2.4', version: '2.4', effectiveDate: '2026-08-08', lastUpdated: '2026-08-08', status: 'Published' },
      },
    };
  }

  static async updatePlatformSettings(newSettings: any) {
    const existing = await this.getPlatformSettings();
    const updated = { ...existing, ...newSettings };
    await CacheService.set(this.CACHE_KEY, updated, this.TTL);
    return updated;
  }
}
