"use client";

import React from 'react';
import { Bell, Send, CheckCheck, XCircle, Clock, AlertTriangle, Layers } from 'lucide-react';

export default function NotificationBroadcastPage() {
  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Notification & Broadcast Center</h1>
          <p className="text-xs text-gray-500 font-medium">Push, SMS, Email, and WhatsApp Campaigns with Real-Time Delivery Tracking</p>
        </div>

        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2">
          <Send size={14} />
          Create Broadcast Campaign
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
        {[
          { label: 'Queued', value: '0', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
          { label: 'Sent', value: '0', color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { label: 'Delivered', value: '0', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          { label: 'Read', value: '0', color: 'bg-green-50 text-green-700 border-green-200' },
          { label: 'Failed (Retry Queue)', value: '0', color: 'bg-red-50 text-red-700 border-red-200' }
        ].map(item => (
          <div key={item.label} className={`p-4 rounded-2xl border ${item.color} shadow-sm space-y-1`}>
            <span className="text-[9px] font-black uppercase tracking-wider block opacity-80">{item.label}</span>
            <span className="text-xl font-black">{item.value}</span>
          </div>
        ))}
      </div>

      <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-8 text-center text-gray-400 border-dashed py-16 space-y-2">
        <Bell size={40} className="mx-auto text-blue-500 opacity-60" />
        <p className="text-xs font-bold text-gray-700">Notification Engine Ready</p>
        <p className="text-[10px] text-gray-400">Target campaigns by city, category, customer/provider role, or active status.</p>
      </div>
    </div>
  );
}
