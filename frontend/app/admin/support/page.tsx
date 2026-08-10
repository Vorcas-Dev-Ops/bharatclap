"use client";

import React, { useState } from 'react';
import AdminLiveChatConsole from '@/components/admin/chat/AdminLiveChatConsole';
import { LifeBuoy, MessageSquare, PhoneCall, Clock, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function SupportCRMPage() {
  const [activeView, setActiveView] = useState<'live_chat' | 'tickets'>('live_chat');

  return (
    <div className="space-y-6 pb-12">
      {/* View Switcher Header */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('live_chat')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeView === 'live_chat'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-purple-400" />
            <span>Admin Live Chat & Interceptor Console</span>
          </button>
          <button
            onClick={() => setActiveView('tickets')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeView === 'tickets'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <LifeBuoy className="w-4 h-4 text-indigo-400" />
            <span>Support Tickets & SLA CRM</span>
          </button>
        </div>
        <span className="text-[11px] font-mono text-emerald-600 font-semibold px-3 py-1 bg-emerald-50 rounded-full">
          Chat Engine Connected 🟢
        </span>
      </div>

      {activeView === 'live_chat' ? (
        <AdminLiveChatConsole />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Open Tickets</span>
              <span className="text-2xl font-black text-blue-600 block">3</span>
            </div>
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Live Chats</span>
              <span className="text-2xl font-black text-purple-600 block">3</span>
            </div>
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SLA Escalated</span>
              <span className="text-2xl font-black text-rose-500 block">1</span>
            </div>
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Resolved Today</span>
              <span className="text-2xl font-black text-emerald-600 block">12</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
