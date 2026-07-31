"use client";

import React, { useState } from 'react';
import CityToggleRegistry from '@/components/admin/location/CityToggle';
import AdminServiceAreaManagement from '@/components/admin/location/AdminServiceAreaManagement';
import AdminLayout from '@/components/admin/layout/AdminLayout';
import { MapPin, ShieldAlert, Layers } from 'lucide-react';
import { Tabs } from 'antd';

export default function LocationsPage() {
  const [activeTab, setActiveTab] = useState('registry');

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        
        {/* Header Tabs */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <MapPin className="text-blue-600" size={28} /> Location & Service Area Control Center
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              Manage operational hubs, provider service area governance, emergency dispatch overrides, and audit trails.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
            <button
              onClick={() => setActiveTab('registry')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'registry' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <MapPin size={16} /> City & Hub Registry
            </button>

            <button
              onClick={() => setActiveTab('governance')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'governance' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <ShieldAlert size={16} className="text-amber-500" /> Area Governance & Overrides
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'registry' ? (
          <CityToggleRegistry />
        ) : (
          <AdminServiceAreaManagement />
        )}

      </div>
    </AdminLayout>
  );
}
