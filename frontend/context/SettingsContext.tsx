"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { API_URL } from '@/config/api';

interface SettingsContextType {
  platformName: string;
  supportEmail: string;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  platformName: 'FIXVO',
  supportEmail: 'support@fixvo.com',
  loading: true,
  refreshSettings: async () => {},
});

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [platformName, setPlatformName] = useState('FIXVO');
  const [supportEmail, setSupportEmail] = useState('support@fixvo.com');
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/settings`);
      if (response.data) {
        setPlatformName(response.data.platform_name || 'FIXVO');
        setSupportEmail(response.data.support_email || 'support@fixvo.com');
      }
    } catch (error) {
      console.error('Error fetching global settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ platformName, supportEmail, loading, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
