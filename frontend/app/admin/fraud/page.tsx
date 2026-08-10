"use client";

import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Lock, Key, Smartphone, MapPin, CheckCircle2, UserX } from 'lucide-react';

export default function FraudSecurityPage() {
  const [activeTab, setActiveTab] = useState<'fraud' | 'security'>('fraud');

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Fraud & Security Center</h1>
          <p className="text-xs text-gray-500 font-medium">Rule-based Fraud Detection, Security Audits, Failed Logins, and Suspicious Device Tracking</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('fraud')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all uppercase tracking-wider ${
              activeTab === 'fraud' ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-white/60 text-gray-600 border-white/60'
            }`}
          >
            Fraud Risk Queue
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all uppercase tracking-wider ${
              activeTab === 'security' ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-white/60 text-gray-600 border-white/60'
            }`}
          >
            Security Audit Log
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Refund Abuse Risk</span>
          <span className="text-xl font-black text-red-600 block">0 Cases</span>
        </div>
        <div className="p-4 bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">COD Abuse Risk</span>
          <span className="text-xl font-black text-orange-600 block">0 Cases</span>
        </div>
        <div className="p-4 bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Shared PAN/Bank</span>
          <span className="text-xl font-black text-amber-600 block">0 Flagged</span>
        </div>
        <div className="p-4 bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rate Limit Hits</span>
          <span className="text-xl font-black text-blue-600 block">0 Today</span>
        </div>
      </div>

      <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-8 text-center text-gray-400 border-dashed py-16 space-y-2">
        <ShieldAlert size={40} className="mx-auto text-red-500 opacity-60" />
        <p className="text-xs font-bold text-gray-700">Fraud & Security Detector Active</p>
        <p className="text-[10px] text-gray-400">Rules constantly evaluate refund velocity, OTP failures, shared credentials, and GPS anomalies.</p>
      </div>
    </div>
  );
}
