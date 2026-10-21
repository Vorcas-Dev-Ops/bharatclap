"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  PackageCheck, 
  Search, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Phone, 
  User, 
  Calendar, 
  Building, 
  FileText, 
  ShieldCheck, 
  AlertCircle, 
  RefreshCw, 
  Copy, 
  Check, 
  Save, 
  QrCode,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { authFetch } from '@/utils/authFetch';
import { API_URL } from '@/config/api';
import { message } from 'antd';

interface CollectionSettings {
  id?: string;
  location_name: string;
  collection_address: string;
  contact_person: string;
  contact_number: string;
  collection_instructions: string;
  operating_hours?: string;
}

interface PendingCollection {
  provider_id: string;
  provider_name: string;
  phone: string;
  collection_id: string;
  kit_payment_status: string;
  kit_payment_id?: string;
  kit_collection_status: string;
  kit_payment_date: string;
}

interface CollectedHistoryItem {
  provider_id: string;
  provider_name: string;
  phone: string;
  collection_id: string;
  kit_payment_status: string;
  kit_collection_status: string;
  collected_at: string;
  confirmed_by: string;
  kit_payment_date?: string;
}

export default function KitCollectionTab() {
  const [subTab, setSubTab] = useState<'pending' | 'settings' | 'history'>('pending');
  const [messageApi, contextHolder] = message.useMessage();

  // Settings State
  const [settings, setSettings] = useState<CollectionSettings>({
    location_name: '',
    collection_address: '',
    contact_person: '',
    contact_number: '',
    collection_instructions: '',
    operating_hours: 'Mon - Sat: 10:00 AM - 6:00 PM'
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Pending Collections State
  const [pendingList, setPendingList] = useState<PendingCollection[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [searchPending, setSearchPending] = useState('');

  // History State
  const [historyList, setHistoryList] = useState<CollectedHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState('');

  const [scanQuery, setScanQuery] = useState('');
  const [selectedForVerification, setSelectedForVerification] = useState<PendingCollection | null>(null);
  const [verificationChecks, setVerificationChecks] = useState({
    providerIdentity: false,
    collectionId: false,
    kitPayment: false,
    kitHandedOver: false
  });
  const [confirming, setConfirming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const openVerificationModal = (item: PendingCollection) => {
    setVerificationChecks({
      providerIdentity: false,
      collectionId: false,
      kitPayment: false,
      kitHandedOver: false
    });
    setSelectedForVerification(item);
  };

  // ─── Fetch Settings ────────────────────────────────────────────────────────
  const fetchSettings = async () => {
    try {
      setLoadingSettings(true);
      const res = await authFetch(`${API_URL}/providers/admin/kit-collection/settings`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.location_name) {
          setSettings(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch collection settings', err);
    } finally {
      setLoadingSettings(false);
    }
  };

  // ─── Save Settings ─────────────────────────────────────────────────────────
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings.location_name.trim() || !settings.collection_address.trim()) {
      messageApi.error('Location name and address are required');
      return;
    }
    try {
      setSavingSettings(true);
      const res = await authFetch(`${API_URL}/providers/admin/kit-collection/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) setSettings(data.settings);
        messageApi.success('Collection hub settings saved successfully!');
      } else {
        messageApi.error('Failed to save collection settings');
      }
    } catch (err) {
      console.error(err);
      messageApi.error('An unexpected error occurred');
    } finally {
      setSavingSettings(false);
    }
  };

  // ─── Fetch Pending Collections ─────────────────────────────────────────────
  const fetchPending = async () => {
    try {
      setLoadingPending(true);
      const res = await authFetch(`${API_URL}/providers/admin/kit-collection/pending`);
      if (res.ok) {
        const data = await res.json();
        setPendingList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch pending collections', err);
    } finally {
      setLoadingPending(false);
    }
  };

  // ─── Fetch History ─────────────────────────────────────────────────────────
  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await authFetch(`${API_URL}/providers/admin/kit-collection/history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchPending();
    fetchHistory();
  }, []);

  // ─── Quick Scan / Search Handler ───────────────────────────────────────────
  const handleQuickScanSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = scanQuery.trim();
    if (!query) return;

    // Search in pendingList by collection ID or provider ID or phone
    const match = pendingList.find(
      p => p.collection_id.toLowerCase() === query.toLowerCase() ||
           p.provider_id.toLowerCase() === query.toLowerCase() ||
           p.phone.includes(query)
    );

    if (match) {
      openVerificationModal(match);
      setScanQuery('');
    } else {
      // Check if it's already in history
      const histMatch = historyList.find(
        h => h.collection_id.toLowerCase() === query.toLowerCase() ||
             h.provider_id.toLowerCase() === query.toLowerCase()
      );
      if (histMatch) {
        messageApi.info(`Collection ID ${histMatch.collection_id} was already collected on ${new Date(histMatch.collected_at).toLocaleDateString()}`);
      } else {
        messageApi.warning(`No pending collection found for "${query}"`);
      }
    }
  };

  // ─── Confirm Collection ───────────────────────────────────────────────────
  const handleConfirmCollection = async (item: PendingCollection) => {
    try {
      setConfirming(true);
      const res = await authFetch(`${API_URL}/providers/admin/kit-collection/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection_id: item.collection_id,
          provider_id: item.provider_id
        })
      });

      if (res.ok) {
        const data = await res.json();
        messageApi.success('Provider Visited & Kit Collected confirmed! ✓');
        setSelectedForVerification(null);
        fetchPending();
        fetchHistory();
      } else {
        const errData = await res.json().catch(() => ({}));
        messageApi.error(errData.message || 'Failed to confirm collection');
      }
    } catch (err) {
      console.error(err);
      messageApi.error('Error confirming collection');
    } finally {
      setConfirming(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    messageApi.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered lists
  const filteredPending = useMemo(() => {
    if (!searchPending.trim()) return pendingList;
    const q = searchPending.toLowerCase();
    return pendingList.filter(
      p => p.collection_id.toLowerCase().includes(q) ||
           p.provider_name.toLowerCase().includes(q) ||
           p.phone.includes(q) ||
           p.provider_id.toLowerCase().includes(q)
    );
  }, [pendingList, searchPending]);

  const filteredHistory = useMemo(() => {
    if (!searchHistory.trim()) return historyList;
    const q = searchHistory.toLowerCase();
    return historyList.filter(
      h => h.collection_id.toLowerCase().includes(q) ||
           h.provider_name.toLowerCase().includes(q) ||
           h.phone.includes(q) ||
           h.confirmed_by.toLowerCase().includes(q)
    );
  }, [historyList, searchHistory]);

  return (
    <div className="space-y-5">
      {contextHolder}

      {/* ── Sub Navigation Tabs ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
          <button
            onClick={() => setSubTab('pending')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              subTab === 'pending'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock size={15} />
            Pending Collections
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              subTab === 'pending' ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {pendingList.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              subTab === 'history'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CheckCircle2 size={15} />
            Collected History
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              subTab === 'history' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {historyList.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              subTab === 'settings'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Building size={15} />
            Collection Hub & Settings
          </button>
        </div>

        {/* Quick Refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (subTab === 'pending') fetchPending();
              else if (subTab === 'history') fetchHistory();
              else fetchSettings();
              messageApi.info('Refreshed data');
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* ── TAB 1: PENDING COLLECTIONS ────────────────────────────────────── */}
      {subTab === 'pending' && (
        <div className="space-y-4">
          {/* Quick Scan / Verify Bar */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
                  <QrCode size={18} className="text-amber-600" />
                  Quick Scan or Search Collection ID
                </div>
                <p className="text-xs text-amber-700/80 mt-0.5">
                  Scan barcode / enter provider Collection ID (e.g. <span className="font-mono font-bold">BC-KIT-84291</span>) to instantly verify and confirm pickup.
                </p>
              </div>

              <form onSubmit={handleQuickScanSearch} className="flex items-center gap-2 max-w-md w-full">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={scanQuery}
                    onChange={(e) => setScanQuery(e.target.value)}
                    placeholder="Enter Collection ID or Phone..."
                    className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl transition-all shadow-sm shadow-amber-600/20 whitespace-nowrap cursor-pointer"
                >
                  Verify ID
                </button>
              </form>
            </div>
          </div>

          {/* Pending Table Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 text-slate-900 font-black text-base">
              <Clock size={18} className="text-amber-500" />
              Pending Kit Collections ({filteredPending.length})
            </div>
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchPending}
                onChange={(e) => setSearchPending(e.target.value)}
                placeholder="Filter by name, phone, or ID..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Provider ID</th>
                    <th className="py-3 px-4">Provider Name</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Collection ID</th>
                    <th className="py-3 px-4">Kit Payment</th>
                    <th className="py-3 px-4">Collection Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingPending ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw className="animate-spin text-amber-500" size={24} />
                          <span className="font-semibold text-xs">Loading pending collections…</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredPending.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <CheckCircle2 className="text-emerald-500" size={32} />
                          <span className="font-bold text-sm text-slate-700">No Pending Kit Collections</span>
                          <span className="text-xs text-slate-500 max-w-sm">
                            All approved providers with paid kits have collected their starter packages.
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPending.map((item) => (
                      <tr key={item.provider_id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                          <span title={item.provider_id}>
                            {item.provider_id.slice(0, 8)}...
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs shrink-0">
                              {item.provider_name.charAt(0).toUpperCase()}
                            </div>
                            <span>{item.provider_name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-semibold">
                          <a href={`tel:${item.phone}`} className="hover:text-blue-600 flex items-center gap-1">
                            <Phone size={11} className="text-slate-400" />
                            {item.phone || '—'}
                          </a>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 font-mono font-bold text-xs">
                            <span>{item.collection_id}</span>
                            <button
                              onClick={() => copyToClipboard(item.collection_id, item.collection_id)}
                              className="text-amber-500 hover:text-amber-700 cursor-pointer"
                              title="Copy Collection ID"
                            >
                              {copiedId === item.collection_id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={11} /> PAID
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            PENDING
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => openVerificationModal(item)}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                          >
                            Verify & Confirm Collection
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: COLLECTED HISTORY ──────────────────────────────────────── */}
      {subTab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                Collected Kits History ({filteredHistory.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Permanent record of providers who collected their Starter Kit at the Hub.</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchHistory}
                onChange={(e) => setSearchHistory(e.target.value)}
                placeholder="Filter by name, ID, or confirmed by..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Collection ID</th>
                    <th className="py-3 px-4">Kit Payment</th>
                    <th className="py-3 px-4">Collection Status</th>
                    <th className="py-3 px-4">Collected Date/Time</th>
                    <th className="py-3 px-4">Confirmed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingHistory ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw className="animate-spin text-emerald-500" size={24} />
                          <span className="font-semibold text-xs">Loading collection history…</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <PackageCheck className="text-slate-300" size={32} />
                          <span className="font-bold text-sm text-slate-700">No Collection History Yet</span>
                          <span className="text-xs text-slate-500">
                            Completed kit pickups will be permanently logged here.
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((item) => (
                      <tr key={item.provider_id + item.collection_id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div>
                            <div className="text-xs text-slate-900 font-bold">{item.provider_name}</div>
                            <div className="text-[11px] text-slate-500 font-normal">{item.phone || item.provider_id.slice(0, 8)}</div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md">
                            {item.collection_id}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={11} /> PAID
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 size={12} className="text-emerald-600" />
                            COLLECTED
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={12} className="text-slate-400" />
                            {item.collected_at ? new Date(item.collected_at).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            }) : '—'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-700">
                          <div className="flex items-center gap-1">
                            <ShieldCheck size={13} className="text-blue-600" />
                            {item.confirmed_by || 'Admin'}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: COLLECTION HUB & SETTINGS ──────────────────────────────── */}
      {subTab === 'settings' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 max-w-4xl">
          <div className="mb-6 pb-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Building size={18} className="text-blue-600" />
                Provider Kit Collection Settings
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure the hub location, address, contact person and instructions shown to providers after kit payment.
              </p>
            </div>
          </div>

          {loadingSettings ? (
            <div className="py-12 flex justify-center items-center">
              <RefreshCw className="animate-spin text-blue-600" size={24} />
            </div>
          ) : (
            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Location Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Location Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.location_name}
                    onChange={(e) => setSettings({ ...settings, location_name: e.target.value })}
                    placeholder="e.g. BharatClap Bengaluru Central Hub"
                    className="w-full px-3.5 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Operating Hours */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Operating Hours
                  </label>
                  <input
                    type="text"
                    value={settings.operating_hours || ''}
                    onChange={(e) => setSettings({ ...settings, operating_hours: e.target.value })}
                    placeholder="e.g. Mon - Sat: 10:00 AM - 6:00 PM"
                    className="w-full px-3.5 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Collection Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Collection Address <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={settings.collection_address}
                  onChange={(e) => setSettings({ ...settings, collection_address: e.target.value })}
                  placeholder="Enter full physical address with floor, landmark, area, and pincode..."
                  className="w-full px-3.5 py-2 text-xs font-medium bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Contact Person */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Contact Person <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.contact_person}
                    onChange={(e) => setSettings({ ...settings, contact_person: e.target.value })}
                    placeholder="e.g. Operations Desk / Kit Distribution Team"
                    className="w-full px-3.5 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Contact Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Contact Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.contact_number}
                    onChange={(e) => setSettings({ ...settings, contact_number: e.target.value })}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3.5 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Collection Instructions */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Collection Instructions
                </label>
                <textarea
                  rows={3}
                  value={settings.collection_instructions}
                  onChange={(e) => setSettings({ ...settings, collection_instructions: e.target.value })}
                  placeholder="e.g. Please carry your original Aadhaar Card and show your Collection ID at the reception counter..."
                  className="w-full px-3.5 py-2 text-xs font-medium bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save size={14} />
                  {savingSettings ? 'Saving Details...' : 'Save Collection Details'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── MODAL: VERIFY & CONFIRM COLLECTION ────────────────────────────── */}
      <AnimatePresence>
        {selectedForVerification && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                    Hub Verification
                  </span>
                  <h3 className="text-lg font-black text-slate-900 mt-1">
                    Verify Provider & Confirm Kit Collection
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedForVerification(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Provider Identity & Payment Info Card */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5 border border-slate-200/80 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Provider Name:</span>
                  <span className="font-black text-slate-900">{selectedForVerification.provider_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Registered Phone:</span>
                  <span className="font-bold text-slate-800 font-mono">{selectedForVerification.phone || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Provider ID:</span>
                  <span className="font-mono text-slate-600 text-[11px]">{selectedForVerification.provider_id}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-amber-800 font-bold">Collection ID:</span>
                  <span className="font-mono font-black text-amber-900 bg-amber-100 px-3 py-1 rounded-lg border border-amber-300 text-sm">
                    {selectedForVerification.collection_id}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Kit Payment ID:</span>
                  <span className="font-mono text-slate-700 text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                    {selectedForVerification.kit_payment_id || 'Captured Onboarding'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Payment Date:</span>
                  <span className="text-slate-700 font-medium">
                    {selectedForVerification.kit_payment_date ? new Date(selectedForVerification.kit_payment_date).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    }) : 'Verified'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-bold">Collection Status:</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                    {selectedForVerification.kit_collection_status || 'PENDING'}
                  </span>
                </div>
              </div>

              {/* Mandatory Verification Checklist */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold flex items-center gap-1.5 text-blue-950">
                    <ShieldCheck size={16} className="text-blue-600" />
                    Mandatory Counter Checklist
                  </div>
                  <button
                    type="button"
                    onClick={() => setVerificationChecks({
                      providerIdentity: true,
                      collectionId: true,
                      kitPayment: true,
                      kitHandedOver: true
                    })}
                    className="text-[11px] font-black text-blue-700 hover:text-blue-900 underline cursor-pointer"
                  >
                    Check All
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-blue-100 cursor-pointer hover:bg-blue-50/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={verificationChecks.providerIdentity}
                      onChange={(e) => setVerificationChecks(prev => ({ ...prev, providerIdentity: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="text-[11px]">
                      <span className="font-bold text-slate-900">Provider identity verified</span>
                      <p className="text-slate-500">Original Govt ID matches the registered Provider profile.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-blue-100 cursor-pointer hover:bg-blue-50/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={verificationChecks.collectionId}
                      onChange={(e) => setVerificationChecks(prev => ({ ...prev, collectionId: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="text-[11px]">
                      <span className="font-bold text-slate-900">Collection ID verified</span>
                      <p className="text-slate-500">Collection ID matches the token displayed on the provider&apos;s app.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-blue-100 cursor-pointer hover:bg-blue-50/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={verificationChecks.kitPayment}
                      onChange={(e) => setVerificationChecks(prev => ({ ...prev, kitPayment: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="text-[11px]">
                      <span className="font-bold text-slate-900">Kit payment verified</span>
                      <p className="text-slate-500">One-time starter kit fee (₹639) successfully paid & captured.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-blue-100 cursor-pointer hover:bg-blue-50/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={verificationChecks.kitHandedOver}
                      onChange={(e) => setVerificationChecks(prev => ({ ...prev, kitHandedOver: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="text-[11px]">
                      <span className="font-bold text-slate-900">Physical kit handed over</span>
                      <p className="text-slate-500">Uniform, ID badge, and BharatClap starter kit bag handed over.</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={confirming}
                  onClick={() => setSelectedForVerification(null)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    confirming ||
                    !(
                      verificationChecks.providerIdentity &&
                      verificationChecks.collectionId &&
                      verificationChecks.kitPayment &&
                      verificationChecks.kitHandedOver
                    )
                  }
                  onClick={() => handleConfirmCollection(selectedForVerification)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 size={15} />
                  {confirming ? 'Confirming...' : 'Confirm Kit Collection'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
