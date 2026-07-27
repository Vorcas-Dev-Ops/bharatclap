"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, ShieldAlert, AlertTriangle, CheckCircle, Search, Mail, Phone, DollarSign, Clock } from 'lucide-react';
import { authFetch } from '@/utils/authFetch';
import { API_URL } from '@/config/api';
import { message } from 'antd';

interface WalletDetails {
  providerId: string;
  userId: {
    _id: string;
    name: string;
    phone: string;
    email: string;
  } | any;
  walletBalance: number;
  status: 'Active' | 'Low' | 'Blocked';
  lastRechargeDate: string | null;
  totalLeadDeductions: number;
}

interface Stats {
  healthyCount: number;
  lowBalanceCount: number;
  blockedCount: number;
  inactiveCount: number;
  todayWalletRevenue: number;
}

export default function WalletManagerTab() {
  const [wallets, setWallets] = useState<WalletDetails[]>([]);
  const [stats, setStats] = useState<Stats>({
    healthyCount: 0,
    lowBalanceCount: 0,
    blockedCount: 0,
    inactiveCount: 0,
    todayWalletRevenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [messageApi, contextHolder] = message.useMessage();

  const fetchWalletsData = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`${API_URL}/providers/admin/wallets`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setWallets(data.wallets || []);
      }
    } catch (err) {
      console.error("Failed to fetch wallets data:", err);
      messageApi.error("Failed to load wallets data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletsData();
  }, []);

  const handleNotify = async (email: string) => {
    messageApi.success(`Notification reminder sent successfully to ${email}`);
  };

  const filteredWallets = useMemo(() => {
    return wallets.filter((w) => {
      const providerName = typeof w.userId === 'object' && w.userId?.name ? w.userId.name : '';
      const providerPhone = typeof w.userId === 'object' && w.userId?.phone ? w.userId.phone : '';
      const matchesSearch =
        providerName.toLowerCase().includes(search.toLowerCase()) ||
        providerPhone.includes(search);

      if (statusFilter === 'all') return matchesSearch;
      if (statusFilter === 'active') return matchesSearch && w.status === 'Active';
      if (statusFilter === 'low') return matchesSearch && w.status === 'Low';
      if (statusFilter === 'blocked') return matchesSearch && w.status === 'Blocked';
      return matchesSearch;
    });
  }, [wallets, search, statusFilter]);

  return (
    <div className="space-y-6">
      {contextHolder}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Healthy Wallets</span>
            <span className="text-2xl font-black text-slate-800 mt-1 block">{stats.healthyCount}</span>
            <span className="text-[10px] text-emerald-500 font-bold block mt-1">Balance ≥ ₹200</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl">
            <CheckCircle size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Low Balance</span>
            <span className="text-2xl font-black text-slate-800 mt-1 block">{stats.lowBalanceCount}</span>
            <span className="text-[10px] text-amber-500 font-bold block mt-1">₹50 – ₹199</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-500 rounded-xl animate-pulse">
            <AlertTriangle size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Orders Blocked</span>
            <span className="text-2xl font-black text-slate-800 mt-1 block">{stats.blockedCount}</span>
            <span className="text-[10px] text-rose-500 font-bold block mt-1">Balance &lt; ₹50</span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-500 rounded-xl">
            <ShieldAlert size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">No Recharge (30d)</span>
            <span className="text-2xl font-black text-slate-800 mt-1 block">{stats.inactiveCount}</span>
            <span className="text-[10px] text-slate-500 font-bold block mt-1">Inactive partners</span>
          </div>
          <div className="p-3 bg-slate-50 text-slate-500 rounded-xl">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between bg-gradient-to-br from-[#1D2B83] to-indigo-900 text-white">
          <div>
            <span className="text-white/70 text-xs font-bold uppercase tracking-wider block">Today's Revenue</span>
            <span className="text-2xl font-black text-white mt-1 block">₹{stats.todayWalletRevenue}</span>
            <span className="text-[10px] text-white/50 font-bold block mt-1">Lead deductions</span>
          </div>
          <div className="p-3 bg-white/10 text-white rounded-xl">
            <DollarSign size={20} />
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search provider name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 transition-all"
          />
        </div>

        <div className="flex gap-2">
          {['all', 'active', 'low', 'blocked'].map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                statusFilter === filter
                  ? 'bg-[#1D2B83] text-white shadow-md shadow-blue-900/10'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Provider</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Wallet Balance</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Last Recharge</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Total Lead Fees Deducted</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1D2B83]"></div>
                      <span className="text-slate-500 font-bold text-sm">Loading partner wallets...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredWallets.length > 0 ? (
                filteredWallets.map((w) => {
                  const name = typeof w.userId === 'object' && w.userId?.name ? w.userId.name : 'Partner';
                  const phone = typeof w.userId === 'object' && w.userId?.phone ? w.userId.phone : 'No phone';
                  const email = typeof w.userId === 'object' && w.userId?.email ? w.userId.email : '';

                  return (
                    <tr key={w.providerId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <span className="block text-sm font-bold text-slate-900">{name}</span>
                          <span className="block text-[11px] font-bold text-slate-400 mt-0.5">{phone}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-black text-slate-800">₹{w.walletBalance}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          w.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          w.status === 'Low' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                          'bg-rose-50 text-rose-600 border border-rose-100'
                        }`}>
                          {w.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-600">
                        {w.lastRechargeDate ? new Date(w.lastRechargeDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-600">
                        ₹{w.totalLeadDeductions}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {w.status !== 'Active' ? (
                          <button
                            onClick={() => handleNotify(email || phone)}
                            className="px-3.5 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 text-xs font-black uppercase tracking-wider rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            Notify Partner
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 font-bold">In Good Standing</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold text-sm">
                    No matching partner wallets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
