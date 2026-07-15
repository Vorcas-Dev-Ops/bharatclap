"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Package, FileImage, UserMinus, ShoppingCart, ClipboardList, PackageCheck } from 'lucide-react';
import ConfigurationTab from './tabs/ConfigurationTab';
import KitPickupsTab from './tabs/KitPickupsTab';
import WaiversTab from './tabs/WaiversTab';
import ImagesTab from './tabs/ImagesTab';
import KitTrackingTab from './tabs/KitTrackingTab';

export default function StarterKitManager() {
  const [activeTab, setActiveTab] = useState('configuration');

  const tabs = [
    { id: 'configuration', label: 'Configuration', icon: Settings },
    { id: 'tracking', label: 'Kit Tracking', icon: ClipboardList },
    { id: 'pickups', label: 'Kit Pickups', icon: PackageCheck },
    { id: 'waivers', label: 'Waivers', icon: UserMinus },
    { id: 'images', label: 'Assets & Images', icon: FileImage }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Provider Starter Kit</h1>
        <p className="text-sm font-medium text-gray-500 mt-1">Manage onboarding kits, pricing, inventory, and provider orders.</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === 'configuration' && <ConfigurationTab />}
        {activeTab === 'tracking' && <KitTrackingTab />}
        {activeTab === 'pickups' && <KitPickupsTab />}
        {activeTab === 'waivers' && <WaiversTab />}
        {activeTab === 'images' && <ImagesTab />}
      </motion.div>
    </div>
  );
}
