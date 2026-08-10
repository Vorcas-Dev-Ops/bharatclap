"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '@/config/api';

export interface SocialLinks {
  facebook: string;
  twitter: string;
  instagram: string;
  linkedin: string;
  youtube: string;
}

export interface SupportStatus {
  status: "Available" | "Busy" | "Closed" | "Holiday";
  badge: string;
  textColor: string;
  bgColor: string;
  expectedResponseTime: string;
}

export interface LegalDocMeta {
  documentId: string;
  version: string;
  effectiveDate: string;
  lastUpdated: string;
  status: 'Draft' | 'Published' | 'Archived';
}

interface SettingsContextType {
  companyName: string;
  platformName: string;
  supportEmail: string;
  businessEmail: string;
  platformLogo: string;
  supportPhone: string;
  companyAddress: string;
  workingHours: string;
  gstNumber: string;
  appVersion: string;
  buildNumber: string;
  emergencyContact: string;
  socialLinks: SocialLinks;
  policiesVersion: string;
  lastUpdated: string;
  legalDocuments: Record<string, LegalDocMeta>;
  supportStatusMode: 'auto' | 'manual';
  manualSupportStatus: 'Open' | 'Busy' | 'Closed' | 'Holiday';
  supportStatus: SupportStatus;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const defaultSocialLinks: SocialLinks = {
  facebook: 'https://facebook.com/bharatclap',
  twitter: 'https://twitter.com/bharatclap',
  instagram: 'https://instagram.com/bharatclap',
  linkedin: 'https://linkedin.com/company/bharatclap',
  youtube: 'https://youtube.com/c/bharatclap',
};

const defaultLegalDocs: Record<string, LegalDocMeta> = {
  privacy: { documentId: 'DOC-PRIV-2026-V2.4', version: '2.4', effectiveDate: '2026-08-08', lastUpdated: '2026-08-08', status: 'Published' },
  terms: { documentId: 'DOC-TRMS-2026-V2.4', version: '2.4', effectiveDate: '2026-08-08', lastUpdated: '2026-08-08', status: 'Published' },
  refunds: { documentId: 'DOC-RFND-2026-V2.4', version: '2.4', effectiveDate: '2026-08-08', lastUpdated: '2026-08-08', status: 'Published' },
  cookies: { documentId: 'DOC-COOK-2026-V1.2', version: '1.2', effectiveDate: '2026-08-08', lastUpdated: '2026-08-08', status: 'Published' },
  community: { documentId: 'DOC-COMM-2026-V2.0', version: '2.0', effectiveDate: '2026-08-08', lastUpdated: '2026-08-08', status: 'Published' },
  provider: { documentId: 'DOC-PROV-2026-V2.4', version: '2.4', effectiveDate: '2026-08-08', lastUpdated: '2026-08-08', status: 'Published' },
};

const computeSupportStatus = (mode: 'auto' | 'manual', manualStatus: 'Open' | 'Busy' | 'Closed' | 'Holiday'): SupportStatus => {
  if (mode === 'manual') {
    switch (manualStatus) {
      case 'Open':
        return {
          status: "Available",
          badge: "🟢 Available Now",
          textColor: "text-emerald-700",
          bgColor: "bg-emerald-100 border-emerald-200",
          expectedResponseTime: "Instant / Under 1 min",
        };
      case 'Busy':
        return {
          status: "Busy",
          badge: "🟡 High Call Volume",
          textColor: "text-amber-700",
          bgColor: "bg-amber-100 border-amber-200",
          expectedResponseTime: "2 to 5 minutes",
        };
      case 'Holiday':
        return {
          status: "Holiday",
          badge: "🏖️ Closed for Holiday",
          textColor: "text-purple-700",
          bgColor: "bg-purple-100 border-purple-200",
          expectedResponseTime: "Reopens next working day",
        };
      case 'Closed':
      default:
        return {
          status: "Closed",
          badge: "🔴 Lines Closed (Emergency Active)",
          textColor: "text-red-700",
          bgColor: "bg-red-100 border-red-200",
          expectedResponseTime: "Reopens at 8:00 AM IST",
        };
    }
  }

  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istTime = new Date(utcMs + (330 * 60000));
  const hour = istTime.getHours();

  if (hour >= 8 && hour < 22) {
    if ((hour >= 10 && hour <= 12) || (hour >= 17 && hour <= 19)) {
      return {
        status: "Busy",
        badge: "🟡 High Call Volume",
        textColor: "text-amber-700",
        bgColor: "bg-amber-100 border-amber-200",
        expectedResponseTime: "2 to 5 minutes",
      };
    }
    return {
      status: "Available",
      badge: "🟢 Available Now",
      textColor: "text-emerald-700",
      bgColor: "bg-emerald-100 border-emerald-200",
      expectedResponseTime: "Instant / Under 1 min",
    };
  }

  return {
    status: "Closed",
    badge: "🔴 Lines Closed (Emergency Active)",
    textColor: "text-red-700",
    bgColor: "bg-red-100 border-red-200",
    expectedResponseTime: "Reopens at 8:00 AM IST",
  };
};

const SettingsContext = createContext<SettingsContextType>({
  companyName: 'BharatClap Technologies Private Limited',
  platformName: 'BharatClap',
  supportEmail: 'support@bharatclap.in',
  businessEmail: 'business@bharatclap.in',
  platformLogo: '',
  supportPhone: '+91 80 4567 8900',
  companyAddress: 'BharatClap Tech Park, Indiranagar, Bengaluru, KA 560038',
  workingHours: 'Monday – Sunday | 8:00 AM – 10:00 PM IST',
  gstNumber: '29ABCDE1234F1Z5',
  appVersion: '1.0.0',
  buildNumber: '20260808.1',
  emergencyContact: '+91 80 4567 8900 (Option 9)',
  socialLinks: defaultSocialLinks,
  policiesVersion: 'v2.4',
  lastUpdated: 'August 8, 2026',
  legalDocuments: defaultLegalDocs,
  supportStatusMode: 'auto',
  manualSupportStatus: 'Open',
  supportStatus: computeSupportStatus('auto', 'Open'),
  loading: true,
  refreshSettings: async () => {},
});

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [companyName, setCompanyName] = useState('BharatClap Technologies Private Limited');
  const [platformName, setPlatformName] = useState('BharatClap');
  const [supportEmail, setSupportEmail] = useState('support@bharatclap.in');
  const [businessEmail, setBusinessEmail] = useState('business@bharatclap.in');
  const [platformLogo, setPlatformLogo] = useState('');
  const [supportPhone, setSupportPhone] = useState('+91 80 4567 8900');
  const [companyAddress, setCompanyAddress] = useState('BharatClap Tech Park, Indiranagar, Bengaluru, KA 560038');
  const [workingHours, setWorkingHours] = useState('Monday – Sunday | 8:00 AM – 10:00 PM IST');
  const [gstNumber, setGstNumber] = useState('29ABCDE1234F1Z5');
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [buildNumber, setBuildNumber] = useState('20260808.1');
  const [emergencyContact, setEmergencyContact] = useState('+91 80 4567 8900 (Option 9)');
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(defaultSocialLinks);
  const [policiesVersion, setPoliciesVersion] = useState('v2.4');
  const [lastUpdated, setLastUpdated] = useState('August 8, 2026');
  const [legalDocuments, setLegalDocuments] = useState<Record<string, LegalDocMeta>>(defaultLegalDocs);
  const [supportStatusMode, setSupportStatusMode] = useState<'auto' | 'manual'>('auto');
  const [manualSupportStatus, setManualSupportStatus] = useState<'Open' | 'Busy' | 'Closed' | 'Holiday'>('Open');
  const [supportStatus, setSupportStatus] = useState<SupportStatus>(computeSupportStatus('auto', 'Open'));
  const [loading, setLoading] = useState(true);

  const fetchSettings = async (): Promise<void> => {
    try {
      let data: any = null;
      try {
        const res = await apiClient.get('/v1/public/settings');
        if (res.data?.data) data = res.data.data;
      } catch {
        try {
          const res = await apiClient.get('/v1/platform/settings');
          if (res.data?.data) data = res.data.data;
        } catch {
          const res = await apiClient.get('/settings');
          if (res.data) data = res.data;
        }
      }

      if (data) {
        const cName  = data.companyName || data.company_name || 'BharatClap Technologies Private Limited';
        const pName  = data.platformName || data.platform_name || 'BharatClap';
        const sEmail = data.supportEmail || data.support_email || 'support@bharatclap.in';
        const bEmail = data.businessEmail || data.business_email || 'business@bharatclap.in';
        const pLogo  = data.platformLogo || data.platform_logo || '';
        const sPhone = data.supportPhone || data.support_phone || '+91 80 4567 8900';
        const cAddr  = data.companyAddress || data.company_address || 'BharatClap Tech Park, Indiranagar, Bengaluru, KA 560038';
        const wHours = data.workingHours || data.working_hours || 'Monday – Sunday | 8:00 AM – 10:00 PM IST';
        const gst    = data.gstNumber || data.gst_number || '29ABCDE1234F1Z5';
        const ver    = data.appVersion || data.app_version || '1.0.0';
        const bNum   = data.buildNumber || data.build_number || '20260808.1';
        const eContact = data.emergencyContact || data.emergency_contact || '+91 80 4567 8900 (Option 9)';
        const pVer   = data.policiesVersion || 'v2.4';
        const lUpdate = data.lastUpdated || 'August 8, 2026';
        const lDocs  = data.legalDocuments || defaultLegalDocs;
        const sMode  = (data.supportStatusMode === 'manual' ? 'manual' : 'auto') as 'auto' | 'manual';
        const mStatus = (data.manualSupportStatus || 'Open') as 'Open' | 'Busy' | 'Closed' | 'Holiday';

        setCompanyName(cName);
        setPlatformName(pName);
        setSupportEmail(sEmail);
        setBusinessEmail(bEmail);
        setPlatformLogo(pLogo);
        setSupportPhone(sPhone);
        setCompanyAddress(cAddr);
        setWorkingHours(wHours);
        setGstNumber(gst);
        setAppVersion(ver);
        setBuildNumber(bNum);
        setEmergencyContact(eContact);
        setPoliciesVersion(pVer);
        setLastUpdated(lUpdate);
        setLegalDocuments(lDocs);
        setSupportStatusMode(sMode);
        setManualSupportStatus(mStatus);
        setSupportStatus(computeSupportStatus(sMode, mStatus));

        if (data.socialLinks) setSocialLinks({ ...defaultSocialLinks, ...data.socialLinks });
      }
      setLoading(false);
    } catch {
      console.warn('[SettingsContext] Using default platform settings');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();

    const interval = setInterval(() => {
      setSupportStatus(computeSupportStatus(supportStatusMode, manualSupportStatus));
    }, 60000);
    return () => clearInterval(interval);
  }, [supportStatusMode, manualSupportStatus]);

  return (
    <SettingsContext.Provider
      value={{
        companyName,
        platformName,
        supportEmail,
        businessEmail,
        platformLogo,
        supportPhone,
        companyAddress,
        workingHours,
        gstNumber,
        appVersion,
        buildNumber,
        emergencyContact,
        socialLinks,
        policiesVersion,
        lastUpdated,
        legalDocuments,
        supportStatusMode,
        manualSupportStatus,
        supportStatus,
        loading,
        refreshSettings: fetchSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
