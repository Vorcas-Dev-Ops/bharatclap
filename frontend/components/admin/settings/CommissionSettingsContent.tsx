"use client";

import React, { useState } from 'react';
import { Percent, Save } from 'lucide-react';

export default function CommissionSettingsContent() {
  const [defaultCommission, setDefaultCommission] = useState('10');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Commission Settings saved successfully!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Commission Settings</h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Configure the platform's revenue sharing model.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-2xl">
        <form onSubmit={handleSave} className="space-y-6">
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
            <p className="text-xs text-slate-500 mt-1">This rate applies to all providers unless overridden by a membership plan.</p>
          </div>

          <div className="pt-4 flex justify-end">
            <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
              <Save size={16} />
              Save Commission Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
