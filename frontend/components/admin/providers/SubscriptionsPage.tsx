'use client';

import React, { useEffect, useState } from 'react';
import { Gift, Search, RefreshCw, Layers, ShieldCheck, Clock, Award, Filter, Edit3 } from 'lucide-react';
import { API_URL } from '@/config/api';
import { authFetch } from '@/utils/authFetch';
import SubscriptionManagementModal from './SubscriptionManagementModal';

export default function SubscriptionsPage() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/providers/admin/subscriptions`);
      if (res.ok) {
        const data = await res.json();
        setProviders(data);
      }
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const filteredProviders = providers.filter(p => {
    const userName = p.user_id?.name || 'Unknown Expert';
    const phone = p.user_id?.phone || '';
    const matchesSearch =
      userName.toLowerCase().includes(search.toLowerCase()) ||
      phone.includes(search) ||
      p._id.includes(search);

    if (!matchesSearch) return false;

    if (filterStatus === 'free_trial') return p.isFreeAccessEnabled;
    if (filterStatus === 'grace_period') return p.subscriptionStatus === 'grace_period';
    if (filterStatus === 'wallet_based') return !p.isFreeAccessEnabled;
    if (filterStatus === 'expiring') return p.subscriptionStatus === 'expiring';

    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 p-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-md shadow-indigo-500/20 shrink-0 mt-1">
            <Gift size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Provider Subscription <span className="text-indigo-600">Management</span>
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Grant Free Access, set trial durations, manage Premium/Sponsored tiers, and monitor active Grace Periods.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="/admin/settings/policies"
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition border border-indigo-100 shadow-sm"
          >
            <Layers className="w-4 h-4 text-indigo-600" />
            Subscription Policies
          </a>
          <button
            onClick={fetchProviders}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search provider name, phone, ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 text-xs font-bold text-slate-900 rounded-xl border border-slate-200/80 focus:bg-white focus:border-indigo-600 focus:outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Providers' },
            { id: 'free_trial', label: 'Free Access' },
            { id: 'grace_period', label: 'Grace Period' },
            { id: 'expiring', label: 'Expiring Soon' },
            { id: 'wallet_based', label: 'Standard Wallet' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterStatus === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Providers Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs font-bold text-slate-400">Loading providers list...</div>
        ) : filteredProviders.length === 0 ? (
          <div className="p-12 text-center text-xs font-bold text-slate-400">No matching providers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold text-xs border-b border-slate-100">
                  <th className="py-3.5 px-5">Provider</th>
                  <th className="py-3.5 px-5">Subscription Mode</th>
                  <th className="py-3.5 px-5">Access Mode</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5">Wallet Credit</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {filteredProviders.map(p => {
                  const userName = p.user_id?.name || 'Service Expert';
                  const userPhone = p.user_id?.phone || 'N/A';

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-900">{userName}</div>
                        <div className="text-[11px] text-slate-400 font-medium">{userPhone}</div>
                      </td>
                      <td className="py-4 px-5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          p.isFreeAccessEnabled
                            ? 'bg-purple-50 text-purple-700 border border-purple-100'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        }`}>
                          {p.isFreeAccessEnabled ? 'Free Access' : 'Standard Wallet'}
                        </span>
                      </td>
                      <td className="py-4 px-5 capitalize font-bold text-slate-800">
                        {p.accessMode || 'standard'}
                      </td>
                      <td className="py-4 px-5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          p.subscriptionStatus === 'grace_period'
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                            : p.subscriptionStatus === 'expiring'
                            ? 'bg-orange-50 text-orange-700 border border-orange-100'
                            : p.subscriptionStatus === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {p.subscriptionStatus || 'active'}
                        </span>
                      </td>
                      <td className="py-4 px-5 font-black text-slate-900">
                        ₹{p.walletBalance || 0}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <button
                          onClick={() => setSelectedProvider(p)}
                          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition inline-flex items-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                          Manage Access
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedProvider && (
        <SubscriptionManagementModal
          provider={selectedProvider}
          onClose={() => setSelectedProvider(null)}
          onSuccess={() => {
            setSelectedProvider(null);
            fetchProviders();
          }}
        />
      )}
    </div>
  );
}
