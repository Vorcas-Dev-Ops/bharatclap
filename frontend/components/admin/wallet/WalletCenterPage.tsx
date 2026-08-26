'use client';

import React, { useEffect, useState } from 'react';
import { Wallet, AlertTriangle, Gift, Clock, ShieldAlert, RefreshCw } from 'lucide-react';
import { API_URL } from '@/config/api';
import { authFetch } from '@/utils/authFetch';

interface Stats {
  lowBalanceCount: number;
  freeAccessCount: number;
  gracePeriodCount: number;
  blockedCodCount: number;
}

export default function WalletCenterPage() {
  const [stats, setStats] = useState<Stats>({
    lowBalanceCount: 0,
    freeAccessCount: 0,
    gracePeriodCount: 0,
    blockedCodCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchWalletStats = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/providers/admin/wallet-center-stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load wallet stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletStats();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 p-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-md shadow-indigo-500/20 shrink-0 mt-1">
            <Wallet size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Admin Wallet & Subscription <span className="text-indigo-600">Center</span>
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Real-time provider wallet balances, active subscription access modes, low credit alerts, and grace period tracking.
            </p>
          </div>
        </div>
        <button
          onClick={fetchWalletStats}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-sm shrink-0"
        >
          <RefreshCw className={`w-4 h-4 text-indigo-600 ${loading ? 'animate-spin' : ''}`} />
          Refresh Metrics
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3 hover:border-slate-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Low Balance Providers</span>
            <span className="p-2.5 bg-red-50 text-red-600 rounded-2xl">
              <AlertTriangle className="w-5 h-5" />
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900">
            {loading ? '...' : stats.lowBalanceCount}
          </div>
          <p className="text-[11px] text-slate-400 font-semibold">Wallet credit below minimum ₹100 threshold</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3 hover:border-slate-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">On Free Access</span>
            <span className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
              <Gift className="w-5 h-5" />
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900">
            {loading ? '...' : stats.freeAccessCount}
          </div>
          <p className="text-[11px] text-slate-400 font-semibold">Trial / Premium / Sponsored zero-fee access</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3 hover:border-slate-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">In Grace Period</span>
            <span className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl">
              <Clock className="w-5 h-5" />
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900">
            {loading ? '...' : stats.gracePeriodCount}
          </div>
          <p className="text-[11px] text-slate-400 font-semibold">7-day soft landing before wallet block</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3 hover:border-slate-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">COD Blocked Dues</span>
            <span className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl">
              <ShieldAlert className="w-5 h-5" />
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900">
            {loading ? '...' : stats.blockedCodCount}
          </div>
          <p className="text-[11px] text-slate-400 font-semibold">Dispatch restricted until Cash remittance</p>
        </div>
      </div>
    </div>
  );
}
