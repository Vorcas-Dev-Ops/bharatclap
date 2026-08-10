"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Search,
  Filter,
  Shield,
  User,
  Briefcase,
  Phone,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Sparkles,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Info,
  Flag,
  FileText,
  Download,
  Trash2,
  Eye,
  ShieldAlert,
  Sliders,
  CheckCheck,
  Calendar
} from 'lucide-react';
import { useChat } from '@/context/ChatContext';

import { apiClient } from '@/config/api';

export default function AdminLiveChatConsole() {
  const {
    threads,
    activeThreadId,
    setActiveThreadId,
    sendMessage,
    deleteMessage,
    resolveThread,
    flagThread,
    exportChat,
  } = useChat();

  const [filterType, setFilterType] = useState<'all' | 'booking' | 'customer_support' | 'provider_support' | 'flagged'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [adminInput, setAdminInput] = useState('');
  const [activeTab, setActiveTab] = useState<'transcript' | 'timeline' | 'moderation' | 'audit'>('transcript');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  React.useEffect(() => {
    apiClient.get('/v1/admin/chat/dashboard').catch(() => {});
  }, []);

  const filteredThreads = threads.filter((t) => {
    if (filterType === 'booking') return t.type === 'booking';
    if (filterType === 'customer_support') return t.type === 'customer_support';
    if (filterType === 'provider_support') return t.type === 'provider_support';
    if (filterType === 'flagged') return t.status === 'flagged' || t.moderation.isFlagged;
    return true;
  }).filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.id.toLowerCase().includes(q) ||
      (t.bookingId && t.bookingId.toLowerCase().includes(q)) ||
      t.customer.name.toLowerCase().includes(q) ||
      (t.provider && t.provider.name.toLowerCase().includes(q)) ||
      t.messages.some((m) => m.text.toLowerCase().includes(q))
    );
  });

  const handleAdminSend = () => {
    if (!adminInput.trim() || !activeThread) return;
    sendMessage(
      activeThread.id,
      adminInput,
      'admin',
      'Admin Support (Sumanth)',
      'admin_01',
      undefined,
      true
    );
    setAdminInput('');
    showToast('Admin Intervention notice broadcasted to conversation');
  };

  const handleExport = (format: 'pdf' | 'csv' | 'txt') => {
    if (!activeThread) return;
    exportChat(activeThread.id, format);
    showToast(`Exported ${activeThread.id} transcript as ${format.toUpperCase()}`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-8 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-purple-500/40 text-xs font-semibold"
          >
            <Sparkles className="w-4 h-4 text-purple-400 animate-spin" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-400/30 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
              Enterprise Live SLA & Chat Command Console
            </span>
          </div>
          <h1 className="text-2xl font-black text-white mt-2 tracking-tight flex items-center gap-2">
            Admin Live Chat & Moderation Console
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Real-time chat supervision, media verification, AI moderation, SLA monitoring, chronological timeline integration, and legal chat export.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 text-center">
            <div className="text-lg font-black text-emerald-400 font-mono">{threads.length}</div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Active Sessions</div>
          </div>
          <div className="bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 text-center">
            <div className="text-lg font-black text-rose-400 font-mono">
              {threads.filter(t => t.moderation.isFlagged || t.status === 'flagged').length}
            </div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">AI Flagged / Risk</div>
          </div>
        </div>
      </div>

      {/* 9. SLA Monitoring Dashboard Bar */}
      {activeThread && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-slate-400 font-semibold uppercase text-[10px] block">First Response Time</span>
              <span className="font-mono font-bold text-slate-800 text-sm">{activeThread.sla.firstResponseSec} sec</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold uppercase text-[10px] block">Average Response Time</span>
              <span className="font-mono font-bold text-slate-800 text-sm">{activeThread.sla.avgResponseMin}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold uppercase text-[10px] block">Resolution Time</span>
              <span className="font-mono font-bold text-slate-800 text-sm">{activeThread.sla.resolutionMin}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold uppercase text-[10px] block">SLA Escalations</span>
              <span className="font-mono font-bold text-slate-800 text-sm">{activeThread.sla.escalations}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono ${
              activeThread.sla.status === 'PASS'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}>
              SLA STATUS: {activeThread.sla.status} 🟢
            </span>

            {/* 6. Chat Export Dropdown */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 px-2 uppercase">Export:</span>
              <button
                onClick={() => handleExport('pdf')}
                className="px-2 py-1 bg-white hover:bg-slate-200 rounded text-[10px] font-bold text-slate-700 shadow-sm"
              >
                PDF
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="px-2 py-1 bg-white hover:bg-slate-200 rounded text-[10px] font-bold text-slate-700 shadow-sm"
              >
                CSV
              </button>
              <button
                onClick={() => handleExport('txt')}
                className="px-2 py-1 bg-white hover:bg-slate-200 rounded text-[10px] font-bold text-slate-700 shadow-sm"
              >
                TXT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3-Column Console View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[640px]">
        {/* Left Column: Chat Threads List & 5. Message Search */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Booking ID, Customer, Provider, Keyword..."
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
              {[
                { id: 'all', label: 'All Chats' },
                { id: 'booking', label: 'Booking' },
                { id: 'customer_support', label: 'Cust Support' },
                { id: 'provider_support', label: 'Prov Support' },
                { id: 'flagged', label: 'AI Flagged ⚠️' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id as any)}
                  className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                    filterType === f.id
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Thread List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredThreads.map((t) => {
              const isSelected = t.id === activeThread?.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setActiveThreadId(t.id)}
                  className={`p-3.5 cursor-pointer transition flex items-start justify-between gap-3 ${
                    isSelected ? 'bg-indigo-50/80 border-l-4 border-indigo-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 truncate">{t.customer.name}</span>
                      {t.provider && <span className="text-[10px] text-slate-400">↔ {t.provider.name}</span>}
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                      <span className="px-1.5 py-0.2 bg-slate-100 rounded text-slate-700 font-bold">
                        {t.bookingId || 'SUPPORT'}
                      </span>
                      <span>•</span>
                      <span className="truncate">{t.serviceTitle || 'General Support'}</span>
                    </div>

                    <p className="text-xs text-slate-600 truncate mt-1">{t.lastMessage}</p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] text-slate-400 font-mono">{t.lastMessageTime}</span>
                    {t.moderation.isFlagged && (
                      <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[9px] font-bold rounded">
                        RISK {t.moderation.riskScore}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Column: Live Conversation & Tab Switcher */}
        <div className="lg:col-span-5 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-sm flex flex-col overflow-hidden">
          {activeThread ? (
            <>
              {/* Active Conversation Header & Tab Switcher */}
              <div className="p-4 bg-slate-950 border-b border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{activeThread.customer.name}</span>
                      {activeThread.provider && (
                        <span className="text-xs text-slate-400">↔ {activeThread.provider.name}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      ID: {activeThread.id} | Booking: {activeThread.bookingId || 'N/A'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => flagThread(activeThread.id)}
                      className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-amber-500/30 transition"
                    >
                      <Flag className="w-3 h-3" /> Flag
                    </button>
                    <button
                      onClick={() => resolveThread(activeThread.id)}
                      className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-emerald-500/30 transition"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Resolve
                    </button>
                  </div>
                </div>

                {/* Sub-tab Navigation */}
                <div className="flex items-center gap-2 pt-1 text-xs border-t border-slate-800">
                  {[
                    { id: 'transcript', label: 'Live Transcript' },
                    { id: 'timeline', label: `Timeline (${activeThread.timelineEvents.length})` },
                    { id: 'moderation', label: `AI Moderation (${activeThread.moderation.riskScore}%)` },
                    { id: 'audit', label: `Audit Log (${activeThread.auditLogs.length})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition ${
                        activeTab === tab.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-tab Content Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar">
                {/* 10. Chat Timeline Tab */}
                {activeTab === 'timeline' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Integrated Booking Lifecycle Timeline</h4>
                    {activeThread.timelineEvents.map((ev) => (
                      <div key={ev.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-start gap-3">
                        <Calendar className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-white text-xs">{ev.title}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{ev.timestamp}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 8. AI Moderation Tab */}
                {activeTab === 'moderation' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">Automated AI Risk Score</span>
                        <span className="text-base font-extrabold text-rose-400 font-mono">{activeThread.moderation.riskScore}/100</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2">
                        <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${activeThread.moderation.riskScore}%` }} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Flagged Keywords & Reasons</h4>
                      {activeThread.moderation.flaggedReasons.length > 0 ? (
                        activeThread.moderation.flaggedReasons.map((r, i) => (
                          <div key={i} className="p-3 bg-rose-950/40 border border-rose-500/40 text-rose-200 rounded-xl text-xs flex items-center justify-between">
                            <span className="font-semibold">{r}</span>
                            <span className="text-[10px] font-mono bg-rose-900 px-2 py-0.5 rounded">FLAGGED</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-400 p-4 bg-slate-950 rounded-xl text-center">No moderation violations detected.</div>
                      )}
                    </div>
                  </div>
                )}

                {/* 7. Chat Audit Log Tab */}
                {activeTab === 'audit' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chat Audit Trail</h4>
                    {activeThread.auditLogs.map((log) => (
                      <div key={log.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold text-purple-300">
                          <span>{log.action.toUpperCase()}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{log.timestamp}</span>
                        </div>
                        <div className="text-slate-300 text-[11px]">{log.details}</div>
                        <div className="text-[9px] text-slate-500 font-mono">Actor: {log.actor} | Correlation ID: {log.correlationId}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Main Transcript Tab */}
                {activeTab === 'transcript' && (
                  activeThread.messages.map((msg) => (
                    <div key={msg.id} className="space-y-1 group">
                      <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-300">{msg.senderName}</span>
                          <span className="px-1.5 py-0.2 bg-slate-800 rounded uppercase text-[9px] text-slate-400">
                            {msg.senderRole}
                          </span>
                          <span>{msg.timestamp}</span>
                        </div>

                        <button
                          onClick={() => deleteMessage(activeThread.id, msg.id)}
                          className="opacity-0 group-hover:opacity-100 transition text-rose-400 hover:text-rose-300 text-[10px] flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>

                      <div
                        className={`p-3 rounded-xl text-xs max-w-[90%] leading-relaxed ${
                          msg.senderRole === 'admin' || msg.isIntervention
                            ? 'bg-purple-950/90 border border-purple-500/50 text-purple-100 shadow-lg'
                            : msg.senderRole === 'customer'
                            ? 'bg-indigo-900/60 border border-indigo-700/50 text-indigo-100'
                            : 'bg-slate-800 border border-slate-700 text-slate-200'
                        }`}
                      >
                        {msg.text}

                        {/* Media display */}
                        {msg.media && (
                          <div className="mt-2 pt-2 border-t border-white/10 text-[11px] text-indigo-300 font-mono">
                            [Attachment: {msg.media.type} - {msg.media.name || 'Location'}]
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Admin Live Intervention Entry Bar */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-purple-300 font-semibold">
                  <span className="flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-purple-400" /> Admin Intervention Bar
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Broadcasts to all participants</span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={adminInput}
                    onChange={(e) => setAdminInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdminSend()}
                    placeholder="Enter official Admin notice / intervention message..."
                    className="flex-1 bg-slate-900 border border-purple-500/40 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                  />
                  <button
                    onClick={handleAdminSend}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> Intervene
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
              <MessageSquare className="w-12 h-12 mb-3 text-slate-600" />
              <p className="text-sm font-semibold">Select a live chat thread to inspect messages and intervene.</p>
            </div>
          )}
        </div>

        {/* Right Column: Participant Metadata & Presence */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4 overflow-y-auto text-xs">
          {activeThread ? (
            <>
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2 text-sm">Participant Presence</h3>

              {/* Customer Metadata Card */}
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-900">Customer</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono px-1.5 py-0.5 rounded uppercase font-bold">
                    {activeThread.customer.presence} 🟢
                  </span>
                </div>
                <div className="font-semibold text-slate-800">{activeThread.customer.name}</div>
                <div className="text-slate-600 flex items-center gap-1"><Phone className="w-3 h-3 text-indigo-600" /> {activeThread.customer.phone}</div>
                <div className="text-[10px] text-slate-500 font-mono">Last seen: {activeThread.customer.lastSeen}</div>
              </div>

              {/* Provider Metadata Card */}
              {activeThread.provider ? (
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900">Provider</span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-mono px-1.5 py-0.5 rounded uppercase font-bold">
                      {activeThread.provider.presence} 🔵
                    </span>
                  </div>
                  <div className="font-semibold text-slate-800">{activeThread.provider.name}</div>
                  <div className="text-slate-600 flex items-center gap-1"><Phone className="w-3 h-3 text-emerald-600" /> {activeThread.provider.phone}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{activeThread.provider.serviceCategory}</div>
                  <div className="text-[10px] text-slate-500 font-mono">Last seen: {activeThread.provider.lastSeen}</div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-center">
                  Direct Support Chat
                </div>
              )}

              {/* Booking Context */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" /> Booking Details
                </div>
                <div className="text-[11px] text-slate-600 font-mono">ID: {activeThread.bookingId || 'N/A'}</div>
                <div className="text-slate-700 font-medium">{activeThread.serviceTitle || 'General Support Ticket'}</div>
              </div>
            </>
          ) : (
            <div className="text-slate-400 text-center py-12">No active thread selected.</div>
          )}
        </div>
      </div>
    </div>
  );
}
