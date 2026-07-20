"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '@/config/api';

interface SettingsContextType {
  platformName: string;
  supportEmail: string;
  platformLogo: string;
  supportPhone: string;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  platformName: 'BHARATCLAP',
  supportEmail: 'support@bharatclap.com',
  platformLogo: '',
  supportPhone: '+91 9876543210',
  loading: true,
  refreshSettings: async () => {},
});

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [platformName, setPlatformName] = useState('BHARATCLAP');
  const [supportEmail, setSupportEmail] = useState('support@bharatclap.com');
  const [platformLogo, setPlatformLogo] = useState('');
  const [supportPhone, setSupportPhone] = useState('+91 9876543210');
  const [loading, setLoading] = useState(true);

  // Fetch with automatic retry
  const fetchSettings = async (attempt = 1): Promise<void> => {
    try {
      const response = await apiClient.get('/settings');
      if (response.data) {
        const pName  = response.data.platform_name  || 'BHARATCLAP';
        const pEmail = response.data.support_email  || 'support@bharatclap.com';
        const pLogo  = response.data.platform_logo  || '';
        const pPhone = response.data.support_phone  || '+91 9876543210';

        setPlatformName(pName);
        setSupportEmail(pEmail);
        setPlatformLogo(pLogo);
        setSupportPhone(pPhone);

        if (typeof window !== 'undefined') {
          localStorage.setItem('platformName', pName);
          localStorage.setItem('supportEmail', pEmail);
          localStorage.setItem('platformLogo', pLogo);
          localStorage.setItem('supportPhone', pPhone);
        }
      }
      setLoading(false);
    } catch (error: any) {
      const isTransient = error?.response?.status === 504 || error?.response?.status === 503 || error?.code === 'ECONNABORTED';
      const maxAttempts = 3;

      if (isTransient && attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[Settings] Catalog service not ready (attempt ${attempt}/${maxAttempts}). Retrying in ${delay / 1000}s...`);
        setTimeout(() => fetchSettings(attempt + 1), delay);
      } else {
        console.warn('[Settings] Using cached/default platform settings');
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // Immediately show cached values from localStorage (warm start)
    if (typeof window !== 'undefined') {
      const cachedName  = localStorage.getItem('platformName');
      const cachedLogo  = localStorage.getItem('platformLogo');
      const cachedEmail = localStorage.getItem('supportEmail');
      const cachedPhone = localStorage.getItem('supportPhone');

      if (cachedName)  setPlatformName(cachedName);
      if (cachedLogo)  setPlatformLogo(cachedLogo);
      if (cachedEmail) setSupportEmail(cachedEmail);
      if (cachedPhone) setSupportPhone(cachedPhone);
    }
    fetchSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SettingsContext.Provider value={{ platformName, supportEmail, platformLogo, supportPhone, loading, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
