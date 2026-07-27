'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Calendar, DollarSign, Clock, RefreshCw, CheckCircle, Save, Layers } from 'lucide-react';
import { API_URL } from '@/config/api';
import { authFetch } from '@/utils/authFetch';

interface Policy {
  policyKey: string;
  name: string;
  description?: string;
  requiresWallet: boolean;
  deductsLeadFee: boolean;
  durationDays: number;
  gracePeriodDays: number;
  isActive: boolean;
}

export default function SubscriptionPoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/providers/admin/subscription-policies`);
      if (res.ok) {
        const data = await res.json();
        setPolicies(data);
      }
    } catch (err) {
      console.error('Failed to load subscription policies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleUpdatePolicy = async (policy: Policy) => {
    setSavingKey(policy.policyKey);
    setFeedbackMsg('');
    try {
      const res = await authFetch(`${API_URL}/providers/admin/subscription-policies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });

      if (res.ok) {
        setFeedbackMsg(`Policy for "${policy.name}" updated successfully.`);
        setTimeout(() => setFeedbackMsg(''), 4000);
      }
    } catch (err) {
      console.error('Failed to save policy:', err);
    } finally {
      setSavingKey(null);
    }
  };

  const handleFieldChange = (key: string, field: keyof Policy, value: any) => {
    setPolicies(prev =>
      prev.map(p => (p.policyKey === key ? { ...p, [field]: value } : p))
    );
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Layers className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Provider Subscription Policies</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configure dynamic rules for Wallet-Based models, Free Trials, Premium tiers, and Grace Periods without code deployments.
          </p>
        </div>
        <button
          onClick={fetchPolicies}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Policies
        </button>
      </div>

      {feedbackMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {feedbackMsg}
        </div>
      )}

      {/* Policies Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-64 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {policies.map(policy => (
            <div
              key={policy.policyKey}
              className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg uppercase tracking-wider">
                    {policy.policyKey}
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-gray-500 font-medium">Policy Active</span>
                    <input
                      type="checkbox"
                      checked={policy.isActive}
                      onChange={e => handleFieldChange(policy.policyKey, 'isActive', e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </label>
                </div>

                <div>
                  <input
                    type="text"
                    value={policy.name}
                    onChange={e => handleFieldChange(policy.policyKey, 'name', e.target.value)}
                    className="w-full text-lg font-bold text-gray-900 dark:text-white bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none transition-colors"
                  />
                  <textarea
                    rows={2}
                    value={policy.description || ''}
                    onChange={e => handleFieldChange(policy.policyKey, 'description', e.target.value)}
                    className="w-full mt-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Enter policy description..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-700/50 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
                      Wallet Required
                    </div>
                    <select
                      value={policy.requiresWallet ? 'yes' : 'no'}
                      onChange={e => handleFieldChange(policy.policyKey, 'requiresWallet', e.target.value === 'yes')}
                      className="w-full bg-white dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-white p-1 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <option value="yes">Yes (Balance Check)</option>
                      <option value="no">No (Free Access)</option>
                    </select>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-700/50 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      Lead Fee Deducted
                    </div>
                    <select
                      value={policy.deductsLeadFee ? 'yes' : 'no'}
                      onChange={e => handleFieldChange(policy.policyKey, 'deductsLeadFee', e.target.value === 'yes')}
                      className="w-full bg-white dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-white p-1 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <option value="yes">Yes (Standard)</option>
                      <option value="no">No (Zero Fee)</option>
                    </select>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-700/50 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" />
                      Duration (Days)
                    </div>
                    <input
                      type="number"
                      value={policy.durationDays}
                      onChange={e => handleFieldChange(policy.policyKey, 'durationDays', Number(e.target.value))}
                      className="w-full bg-white dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-white p-1 rounded-lg border border-gray-200 dark:border-gray-600"
                    />
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-700/50 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      Grace Period (Days)
                    </div>
                    <input
                      type="number"
                      value={policy.gracePeriodDays}
                      onChange={e => handleFieldChange(policy.policyKey, 'gracePeriodDays', Number(e.target.value))}
                      className="w-full bg-white dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-white p-1 rounded-lg border border-gray-200 dark:border-gray-600"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-700/60 flex justify-end">
                <button
                  onClick={() => handleUpdatePolicy(policy)}
                  disabled={savingKey === policy.policyKey}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingKey === policy.policyKey ? 'Saving...' : 'Save Policy Changes'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
