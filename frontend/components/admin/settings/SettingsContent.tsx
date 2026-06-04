"use client";

import React, { useState } from 'react';
import { Sliders, Save, Percent } from 'lucide-react';

export default function SettingsContent() {
  const [platformName, setPlatformName] = useState('FIXVO');
  const [supportEmail, setSupportEmail] = useState('support@fixvo.com');
  const [defaultCommission, setDefaultCommission] = useState('10');

  const handleGeneralSave = (e: React.FormEvent) => {
    e.preventDefault();
    alert('General Settings saved successfully!');
  };

  const handleCommissionSave = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Commission Settings saved successfully!');
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
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

        {/* Commission Settings */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <Percent className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">Commission Settings</h2>
          </div>
          <div className="p-6 flex-1">
            <form onSubmit={handleCommissionSave} className="space-y-6 h-full flex flex-col">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Default Commission Rate (%)</label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="number" 
                    value={defaultCommission}
                    onChange={(e) => setDefaultCommission(e.target.value)}
                    min="0"
                    max="100"
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  This rate determines the platform's cut from each completed service. 
                  It applies to all providers unless specifically overridden by an active membership plan.
                </p>
              </div>

              <div className="pt-4 flex justify-end mt-auto">
                <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-sm">
                  <Save size={16} />
                  Save Commission
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
