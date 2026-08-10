"use client";

import React, { useState } from 'react';
import { ShieldCheck, FileCheck, AlertCircle, Clock, Search, CheckCircle2, XCircle } from 'lucide-react';

export default function VerificationQueuePage() {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'expiring'>('pending');

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Provider Verification Center</h1>
          <p className="text-xs text-gray-500 font-medium">Granular KYC, PAN, Bank, GST, Insurance, Police, and Background Check Verification Queues</p>
        </div>

        <div className="flex items-center gap-2">
          {['pending', 'approved', 'rejected', 'expiring'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all uppercase tracking-wider ${
                activeTab === tab
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                  : 'bg-white/60 text-gray-600 border-white/60 hover:bg-white'
              }`}
            >
              {tab} Queue
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search provider name/phone..."
              className="w-full pl-9 pr-3 py-1.5 bg-white/80 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span className="text-xs font-bold text-gray-500">0 Providers in {activeTab} queue</span>
        </div>

        <div className="border border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400 space-y-2">
          <ShieldCheck size={36} className="mx-auto text-blue-500 opacity-60" />
          <p className="text-xs font-bold text-gray-600">Verification Queue Sync Active</p>
          <p className="text-[10px] text-gray-400">All submitted documents will appear here for real-time compliance review.</p>
        </div>
      </div>
    </div>
  );
}
