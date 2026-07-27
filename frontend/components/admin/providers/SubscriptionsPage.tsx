'use client';

import React, { useEffect, useState } from 'react';
import { Gift, Search, RefreshCw, Filter, Calendar, ShieldCheck, Clock, Layers, ArrowUpRight } from 'lucide-react';
import { API_URL } from '@/config/api';
import { authFetch } from '@/utils/authFetch';
import SubscriptionManagementModal from './SubscriptionManagementModal';

export default function SubscriptionsPage() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/providers?limit=100`);
      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data) ? data : (data.data || data.providers || []);
        setProviders(rawList);
      }
    } catch (err) {
      console.error('Failed to fetch providers for subscriptions page:', err);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleOpenModal = (provider: any) => {
    setSelectedProvider(provider);
    setIsModalOpen(true);
  };

  const safeProviders = Array.isArray(providers) ? providers : [];
  const filteredProviders = safeProviders.filter(p => {
    const user = p.user || (typeof p.user_id === 'object' ? p.user_id : null);
    const matchesSearch =
      (user?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user?.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.provider_id || p._id || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === 'free_access') return p.isFreeAccessEnabled === true;
    if (filterStatus === 'grace_period') return p.subscriptionStatus === 'grace_period';
    if (filterStatus === 'wallet_based') return !p.isFreeAccessEnabled;
    if (filterStatus === 'expiring') return p.subscriptionStatus === 'expiring';

    return true;
  });

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Gift className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Provider Subscription Management</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Grant Free Access, set trial durations, manage Premium/Sponsored tiers, and monitor active Grace Periods.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/admin/settings/policies"
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 rounded-xl hover:bg-indigo-100 transition-colors text-xs font-semibold"
          >
            <Layers className="w-4 h-4" />
            Subscription Policies
          </a>
          <button
            onClick={fetchProviders}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-200 transition-colors text-xs font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search provider name, phone, ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900/50 text-xs rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {[
            { key: 'All', label: 'All Providers' },
            { key: 'free_access', label: 'Free Access' },
            { key: 'grace_period', label: 'Grace Period' },
            { key: 'expiring', label: 'Expiring Soon' },
            { key: 'wallet_based', label: 'Wallet Based' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all whitespace-nowrap ${
                filterStatus === tab.key
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Provider Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading provider subscription records...</div>
        ) : filteredProviders.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No providers match the selected criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="p-4">Provider</th>
                  <th className="p-4">Subscription Model</th>
                  <th className="p-4">Access Tier</th>
                  <th className="p-4">Free Access Status</th>
                  <th className="p-4">End Date</th>
                  <th className="p-4">Wallet Balance</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-700 dark:text-gray-300">
                {filteredProviders.map(p => {
                  const user = p.user || (typeof p.user_id === 'object' ? p.user_id : null);
                  const isFree = p.isFreeAccessEnabled;
                  const status = p.subscriptionStatus || (isFree ? 'active' : 'wallet_based');

                  return (
                    <tr key={p._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-gray-900 dark:text-white">{user?.name || 'Provider'}</div>
                        <div className="text-[10px] text-gray-400">{user?.phone || p.provider_id || p._id}</div>
                      </td>
                      <td className="p-4 font-semibold capitalize">
                        {p.subscriptionType ? p.subscriptionType.replace('_', ' ') : isFree ? 'Free Trial' : 'Wallet Based'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${
                          p.accessMode === 'premium'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                            : p.accessMode === 'sponsored'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {p.accessMode || 'Standard'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold capitalize ${
                          status === 'grace_period'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            : status === 'expiring'
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                            : isFree
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-gray-500">
                        {p.freeAccessEndDate ? new Date(p.freeAccessEndDate).toLocaleDateString() : isFree ? 'Permanent' : 'N/A'}
                      </td>
                      <td className="p-4 font-mono font-bold">
                        ₹{(p.walletBalance || 0) - (p.reservedBalance || 0)}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleOpenModal(p)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs transition-colors shadow-sm"
                        >
                          Manage
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

      {/* Subscription Modal */}
      {selectedProvider && (
        <SubscriptionManagementModal
          provider={selectedProvider}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedProvider(null);
          }}
          onSuccess={fetchProviders}
        />
      )}
    </div>
  );
}
