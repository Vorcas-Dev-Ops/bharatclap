'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Calendar, DollarSign, Clock, RefreshCw, CheckCircle, Save, Layers, Sparkles } from 'lucide-react';
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 p-6 max-w-7xl mx-auto">
      {/* Top Header & Actions */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-md shadow-indigo-500/20 shrink-0 mt-1">
            <Layers size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Provider Subscription <span className="text-indigo-600">Policies</span>
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Configure dynamic rules for Wallet-Based models, Free Trials, Premium tiers, and Grace Periods without code deployments.
            </p>
          </div>
        </div>

        <button
          onClick={fetchPolicies}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-sm shrink-0"
        >
          <RefreshCw className={`w-4 h-4 text-indigo-600 ${loading ? 'animate-spin' : ''}`} />
          Refresh Policies
        </button>
      </div>

      {feedbackMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200 text-xs font-bold flex items-center gap-2 shadow-sm">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          {feedbackMsg}
        </div>
      )}

      {/* Policies Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-64 bg-slate-100 animate-pulse rounded-3xl border border-slate-200/60" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {policies.map(policy => (
            <div
              key={policy.policyKey}
              className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-slate-200 transition-all flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full uppercase tracking-wider">
                    {policy.policyKey}
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 hover:bg-slate-100 transition-all">
                    <span className="text-xs font-bold text-slate-700">Policy Active</span>
                    <input
                      type="checkbox"
                      checked={policy.isActive}
                      onChange={e => handleFieldChange(policy.policyKey, 'isActive', e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                    />
                  </label>
                </div>

                <div>
                  <input
                    type="text"
                    value={policy.name}
                    onChange={e => handleFieldChange(policy.policyKey, 'name', e.target.value)}
                    className="w-full text-xl font-black text-slate-900 bg-transparent border-b border-slate-100 hover:border-slate-300 focus:border-indigo-600 focus:outline-none transition-all py-1"
                  />
                  <textarea
                    rows={2}
                    value={policy.description || ''}
                    onChange={e => handleFieldChange(policy.policyKey, 'description', e.target.value)}
                    className="w-full mt-2.5 text-xs text-slate-600 font-medium bg-slate-50 p-3 rounded-2xl border border-slate-200/80 focus:bg-white focus:border-indigo-600 focus:outline-none transition-all"
                    placeholder="Enter policy description..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5 pt-2">
                  <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                      <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                      Wallet Required
                    </div>
                    <select
                      value={policy.requiresWallet ? 'yes' : 'no'}
                      onChange={e => handleFieldChange(policy.policyKey, 'requiresWallet', e.target.value === 'yes')}
                      className="w-full bg-white text-xs font-bold text-slate-900 p-2 rounded-xl border border-slate-200/80 focus:border-indigo-600 focus:outline-none transition-all"
                    >
                      <option value="yes">Yes (Balance Check)</option>
                      <option value="no">No (Free Access)</option>
                    </select>
                  </div>

                  <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Lead Fee Deducted
                    </div>
                    <select
                      value={policy.deductsLeadFee ? 'yes' : 'no'}
                      onChange={e => handleFieldChange(policy.policyKey, 'deductsLeadFee', e.target.value === 'yes')}
                      className="w-full bg-white text-xs font-bold text-slate-900 p-2 rounded-xl border border-slate-200/80 focus:border-indigo-600 focus:outline-none transition-all"
                    >
                      <option value="yes">Yes (Standard)</option>
                      <option value="no">No (Zero Fee)</option>
                    </select>
                  </div>

                  <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      Duration (Days)
                    </div>
                    <input
                      type="number"
                      value={policy.durationDays}
                      onChange={e => handleFieldChange(policy.policyKey, 'durationDays', Number(e.target.value))}
                      className="w-full bg-white text-xs font-bold text-slate-900 p-2 rounded-xl border border-slate-200/80 focus:border-indigo-600 focus:outline-none transition-all"
                    />
                  </div>

                  <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Grace Period (Days)
                    </div>
                    <input
                      type="number"
                      value={policy.gracePeriodDays}
                      onChange={e => handleFieldChange(policy.policyKey, 'gracePeriodDays', Number(e.target.value))}
                      className="w-full bg-white text-xs font-bold text-slate-900 p-2 rounded-xl border border-slate-200/80 focus:border-indigo-600 focus:outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => handleUpdatePolicy(policy)}
                  disabled={savingKey === policy.policyKey}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
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
