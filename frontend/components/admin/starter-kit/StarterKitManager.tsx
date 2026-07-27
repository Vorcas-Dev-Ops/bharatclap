"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, ClipboardList, PackageCheck, Wallet, Banknote, UserMinus, FileImage, Edit3, X, Save } from 'lucide-react';
import ConfigurationTab from './tabs/ConfigurationTab';
import KitPickupsTab from './tabs/KitPickupsTab';
import WaiversTab from './tabs/WaiversTab';
import ImagesTab from './tabs/ImagesTab';
import KitTrackingTab from './tabs/KitTrackingTab';
import WalletManagerTab from './tabs/WalletManagerTab';
import SettlementsManagerTab from './tabs/SettlementsManagerTab';

export default function StarterKitManager() {
  const [activeTab, setActiveTab] = useState('configuration');
  const [isEditingConfig, setIsEditingConfig] = useState(false);

  const tabs = [
    { id: 'configuration', label: 'Configuration', icon: Settings },
    { id: 'tracking', label: 'Kit Tracking', icon: ClipboardList },
    { id: 'pickups', label: 'Kit Pickups', icon: PackageCheck },
    { id: 'wallets', label: 'Partner Wallets', icon: Wallet },
    { id: 'settlements', label: 'Payout Settlements', icon: Banknote },
    { id: 'waivers', label: 'Waivers', icon: UserMinus },
    { id: 'images', label: 'Assets & Images', icon: FileImage }
  ];

  const handleSaveTrigger = () => {
    const btn = document.getElementById('save-config-trigger');
    if (btn) btn.click();
  };

  return (
    <div className="w-full max-w-[1500px] mx-auto space-y-3 p-0">
      {/* ── HEADER & TABS BAR ── */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 py-1">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Provider Starter Kit</h1>
            <p className="text-xs font-medium text-slate-500 mt-0.5">Manage onboarding kits, pricing, inventory and provider orders.</p>
          </div>
        </div>

        {/* ── TABS ROW WITH EDIT BUTTON ON SAME ROW ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          {/* Left: Pill Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id !== 'configuration') setIsEditingConfig(false);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Right: Edit Configuration Button (EXACT SAME ROW) */}
          {activeTab === 'configuration' && (
            <div className="shrink-0">
              {!isEditingConfig ? (
                <button 
                  type="button"
                  onClick={() => setIsEditingConfig(true)} 
                  className="flex items-center gap-1.5 px-4 py-2 bg-white border border-blue-200 hover:border-blue-400 hover:bg-blue-50/50 text-blue-600 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Edit3 size={14} /> Edit Configuration
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsEditingConfig(false);
                      const cancelBtn = document.getElementById('cancel-config-trigger');
                      if (cancelBtn) cancelBtn.click();
                    }} 
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    <X size={14} /> Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={handleSaveTrigger} 
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    <Save size={14} /> Save Changes
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
      >
        {activeTab === 'configuration' && (
          <ConfigurationTab 
            isEditing={isEditingConfig} 
            setIsEditing={setIsEditingConfig} 
          />
        )}
        {activeTab === 'tracking' && <KitTrackingTab />}
        {activeTab === 'pickups' && <KitPickupsTab />}
        {activeTab === 'wallets' && <WalletManagerTab />}
        {activeTab === 'settlements' && <SettlementsManagerTab />}
        {activeTab === 'waivers' && <WaiversTab />}
        {activeTab === 'images' && <ImagesTab />}
      </motion.div>
    </div>
  );
}
