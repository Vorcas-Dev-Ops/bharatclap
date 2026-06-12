"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { API_URL } from '@/config/api';

interface SettingsContextType {
  platformName: string;
  supportEmail: string;
  platformLogo: string;
  supportPhone: string;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  platformName: 'FIXVO',
  supportEmail: 'support@fixvo.com',
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

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/settings`);
      if (response.data) {
        const pName = response.data.platform_name || 'BHARATCLAP';
        const pEmail = response.data.support_email || 'support@bharatclap.com';
        const pLogo = response.data.platform_logo || '';
        const pPhone = response.data.support_phone || '+91 9876543210';

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
    } catch (error) {
      console.error('Error fetching global settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cachedName = localStorage.getItem('platformName');
      const cachedLogo = localStorage.getItem('platformLogo');
      const cachedEmail = localStorage.getItem('supportEmail');
      const cachedPhone = localStorage.getItem('supportPhone');
      
      if (cachedName) setPlatformName(cachedName);
      if (cachedLogo) setPlatformLogo(cachedLogo);
      if (cachedEmail) setSupportEmail(cachedEmail);
      if (cachedPhone) setSupportPhone(cachedPhone);
    }
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ platformName, supportEmail, platformLogo, supportPhone, loading, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
