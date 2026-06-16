"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Edit2, Save, X, Upload, Globe, Phone, Mail, Building2, ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { App } from 'antd';
import axios from 'axios';
import { API_URL } from '@/config/api';
import { useSettings } from '@/context/SettingsContext';

export default function SettingsContent() {
  const { message } = App.useApp();
  const { platformName: gName, supportEmail: gEmail, platformLogo: gLogo, supportPhone: gPhone, refreshSettings } = useSettings();

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [platformName, setPlatformName] = useState(gName);
  const [supportEmail, setSupportEmail] = useState(gEmail);
  const [platformLogo, setPlatformLogo] = useState(gLogo);
  const [supportPhone, setSupportPhone] = useState(gPhone);
  const [logoPreview, setLogoPreview] = useState(gLogo);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPlatformName(gName);
    setSupportEmail(gEmail);
    setPlatformLogo(gLogo);
    setSupportPhone(gPhone);
    setLogoPreview(gLogo);
  }, [gName, gEmail, gLogo, gPhone]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPlatformLogo(base64);
      setLogoPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleCancel = () => {
    setPlatformName(gName);
    setSupportEmail(gEmail);
    setPlatformLogo(gLogo);
    setSupportPhone(gPhone);
    setLogoPreview(gLogo);
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/settings`, {
        platform_name: platformName,
        support_email: supportEmail,
        platform_logo: platformLogo,
        support_phone: supportPhone,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await refreshSettings();
      message.success('Platform settings updated successfully!');
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
      message.error('Failed to update settings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Platform Settings</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Manage your global platform identity and contact information.</p>
        </div>
        <AnimatePresence mode="wait">
          {!isEditing ? (
            <motion.button
              key="edit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl shadow-sm transition-all"
            >
              <Edit2 size={16} className="text-slate-500" /> Edit Settings
            </motion.button>
          ) : (
            <motion.button
              key="cancel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancel}
              className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-700 text-sm font-bold rounded-xl transition-all shadow-sm"
            >
              <X size={16} /> Cancel Editing
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Logo Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group flex flex-col items-center text-center">
          <div className="absolute top-0 right-0 w-28 h-28 bg-blue-50 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110 pointer-events-none"></div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 mb-5 relative z-10">
            <ImageIcon size={24} />
          </div>
          <h2 className="text-base font-bold text-slate-800 mb-1 relative z-10">Platform Logo</h2>
          <p className="text-xs text-slate-500 mb-6 relative z-10">Shown in the sidebar & emails.</p>

          {/* Logo preview */}
          <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden mb-4 relative z-10">
            {logoPreview ? (
              <img src={logoPreview} alt="Platform Logo" className="w-full h-full object-contain" />
            ) : (
              <Globe size={32} className="text-slate-300" />
            )}
          </div>

          {isEditing ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-2 bg-blue-50 text-blue-600 text-xs font-bold rounded-xl hover:bg-blue-100 transition-colors relative z-10"
              >
                <Upload size={14} /> Upload Logo
              </button>
              {logoPreview && (
                <button
                  onClick={() => { setPlatformLogo(''); setLogoPreview(''); }}
                  className="mt-2 text-xs text-red-500 hover:text-red-700 font-bold relative z-10"
                >
                  Remove
                </button>
              )}
            </>
          ) : (
            <span className="text-xs text-slate-400 font-medium relative z-10">
              {logoPreview ? 'Logo uploaded' : 'No logo set'}
            </span>
          )}
        </div>

        {/* Platform Identity Card */}
        <div className="xl:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-50 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110 pointer-events-none"></div>
          <div className="flex items-center gap-4 mb-8 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Platform Identity</h2>
              <p className="text-xs font-medium text-slate-500">Core branding and contact details.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
            {/* Platform Name */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Platform Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              ) : (
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Globe size={16} className="text-slate-400 flex-shrink-0" />
                  <span className="text-2xl font-black text-slate-900">{platformName || '—'}</span>
                </div>
              )}
            </div>

            {/* Support Email */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Support Email</label>
              {isEditing ? (
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              ) : (
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Mail size={16} className="text-slate-400 flex-shrink-0" />
                  <span className="text-base font-bold text-slate-900 truncate">{supportEmail || '—'}</span>
                </div>
              )}
            </div>

            {/* Support Phone */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Support Phone</label>
              {isEditing ? (
                <input
                  type="tel"
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              ) : (
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Phone size={16} className="text-slate-400 flex-shrink-0" />
                  <span className="text-base font-bold text-slate-900">{supportPhone || '—'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex justify-end pt-4"
          >
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex items-center gap-2 px-8 py-3.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/30 disabled:opacity-60"
            >
              <Save size={18} /> {isLoading ? 'Saving...' : 'Save Settings'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
