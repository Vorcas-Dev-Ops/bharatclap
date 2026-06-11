"use client";

import React, { useState, useEffect } from 'react';
import { Sliders, Save } from 'lucide-react';
import { App } from 'antd';
import axios from 'axios';
import { API_URL } from '@/config/api';
import { useSettings } from '@/context/SettingsContext';

export default function SettingsContent() {
  const { message } = App.useApp();
  const { platformName: globalName, supportEmail: globalEmail, refreshSettings } = useSettings();
  
  const [platformName, setPlatformName] = useState(globalName);
  const [supportEmail, setSupportEmail] = useState(globalEmail);

  useEffect(() => {
    setPlatformName(globalName);
    setSupportEmail(globalEmail);
  }, [globalName, globalEmail]);

  const handleGeneralSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/settings`, {
        platform_name: platformName,
        support_email: supportEmail
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await refreshSettings();
      message.success('Platform settings updated successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      message.error('Failed to update settings');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Platform Settings</h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Manage global platform configurations and revenue models.</p>
        </div>
      </div>

      <div className="max-w-xl">
        
        {/* General Settings */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <Sliders className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">General Settings</h2>
          </div>
          <div className="p-6 flex-1">
            <form onSubmit={handleGeneralSave} className="space-y-6 h-full flex flex-col">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Platform Name</label>
                <input 
                  type="text" 
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Support Email</label>
                <input 
                  type="email" 
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 flex justify-end mt-auto">
                <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
                  <Save size={16} />
                  Save General Settings
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
