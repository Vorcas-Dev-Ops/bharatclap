'use client';

import React, { useEffect, useState } from 'react';
import { Wallet, AlertTriangle, Gift, Clock, ShieldAlert, RefreshCw, ArrowUpRight, Search } from 'lucide-react';
import { API_URL } from '@/config/api';
import { authFetch } from '@/utils/authFetch';

interface WalletStats {
  lowBalanceCount: number;
  freeAccessCount: number;
  gracePeriodCount: number;
  blockedCodCount: number;
}

export default function WalletCenterPage() {
  const [stats, setStats] = useState<WalletStats>({
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
      console.error('Failed to fetch wallet center stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletStats();
  }, []);

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Wallet className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Wallet & Subscription Center</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Real-time provider wallet balances, active subscription access modes, low credit alerts, and grace period tracking.
          </p>
        </div>
        <button
          onClick={fetchWalletStats}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Metrics
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Low Balance Providers</span>
            <span className="p-2 bg-red-50 dark:bg-red-950/40 text-red-600 rounded-xl">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-gray-900 dark:text-white">
            {loading ? '...' : stats.lowBalanceCount}
          </div>
          <p className="text-xs text-gray-400">Wallet credit below minimum ₹100 threshold</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">On Free Access</span>
            <span className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl">
              <Gift className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-gray-900 dark:text-white">
            {loading ? '...' : stats.freeAccessCount}
          </div>
          <p className="text-xs text-gray-400">Trial / Premium / Sponsored zero-fee access</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">In Grace Period</span>
            <span className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-gray-900 dark:text-white">
            {loading ? '...' : stats.gracePeriodCount}
          </div>
          <p className="text-xs text-gray-400">7-day soft landing before wallet block</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">COD Blocked Dues</span>
            <span className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-xl">
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-extrabold text-gray-900 dark:text-white">
            {loading ? '...' : stats.blockedCodCount}
          </div>
          <p className="text-xs text-gray-400">Dispatch restricted until Cash remittance</p>
        </div>
      </div>
    </div>
  );
}
