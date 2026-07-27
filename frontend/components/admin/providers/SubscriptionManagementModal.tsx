'use client';

import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Gift, Calendar, Check, AlertCircle, Clock, History } from 'lucide-react';
import { API_URL } from '@/config/api';
import { authFetch } from '@/utils/authFetch';

interface Props {
  provider: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SubscriptionManagementModal({ provider, isOpen, onClose, onSuccess }: Props) {
  const [subscriptionType, setSubscriptionType] = useState<'wallet_based' | 'free_trial'>('wallet_based');
  const [accessMode, setAccessMode] = useState<'standard' | 'premium' | 'sponsored'>('standard');
  const [durationOption, setDurationOption] = useState<string>('30_days');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    if (provider) {
      setSubscriptionType(provider.subscriptionType || (provider.isFreeAccessEnabled ? 'free_trial' : 'wallet_based'));
      setAccessMode(provider.accessMode || 'standard');
      setReason(provider.freeAccessReason || '');
      fetchAuditLogs(provider._id);
    }
  }, [provider]);

  const fetchAuditLogs = async (providerId: string) => {
    try {
      const res = await authFetch(`${API_URL}/providers/admin/${providerId}/subscription-audit-logs`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    }
  };

  if (!isOpen || !provider) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await authFetch(`${API_URL}/providers/admin/${provider._id}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionType,
          accessMode,
          durationOption,
          customEndDate: customEndDate ? new Date(customEndDate).toISOString() : null,
          reason,
        }),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const data = await res.json();
        setErrorMsg(data.message || 'Failed to update subscription');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Server error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-700 shadow-2xl space-y-6 p-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700/60 pb-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <Gift className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Manage Provider Subscription</h2>
              <p className="text-xs text-gray-500">
                Provider ID: {provider.provider_id || provider._id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Subscription Type Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Subscription Model</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSubscriptionType('wallet_based')}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                  subscriptionType === 'wallet_based'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">Wallet Based (Default)</span>
                  {subscriptionType === 'wallet_based' && <Check className="w-4 h-4 text-indigo-600" />}
                </div>
                <p className="text-xs text-gray-500 mt-2">Requires minimum wallet credit & deducts lead fees.</p>
              </button>

              <button
                type="button"
                onClick={() => setSubscriptionType('free_trial')}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                  subscriptionType === 'free_trial'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">Free Trial Access</span>
                  {subscriptionType === 'free_trial' && <Check className="w-4 h-4 text-indigo-600" />}
                </div>
                <p className="text-xs text-gray-500 mt-2">Zero wallet check & zero lead fees during trial.</p>
              </button>
            </div>
          </div>

          {/* Access Mode */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Access Tier / Mode</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'standard', label: 'Standard', desc: 'Default Access' },
                { key: 'premium', label: 'Premium', desc: 'Priority Pool' },
                { key: 'sponsored', label: 'Sponsored', desc: 'Partner Grant' },
              ].map(mode => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setAccessMode(mode.key as any)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    accessMode === mode.key
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-bold'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500'
                  }`}
                >
                  <div className="text-xs font-semibold">{mode.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{mode.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Duration Options */}
          {(subscriptionType === 'free_trial' || accessMode !== 'standard') && (
            <div className="space-y-3 bg-gray-50 dark:bg-gray-900/40 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                Free Access Duration
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[
                  { key: '7_days', label: '7 Days' },
                  { key: '30_days', label: '30 Days' },
                  { key: '90_days', label: '90 Days' },
                  { key: 'custom', label: 'Custom' },
                  { key: 'permanent', label: 'Permanent' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setDurationOption(opt.key)}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                      durationOption === opt.key
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {durationOption === 'custom' && (
                <div className="pt-2">
                  <label className="text-[10px] text-gray-500 block mb-1">Select Custom End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={e => setCustomEndDate(e.target.value)}
                    className="w-full bg-white dark:bg-gray-800 p-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700"
                  />
                </div>
              )}
            </div>
          )}

          {/* Reason Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Reason / Admin Note</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Promotional Onboarding Offer, Operational Waiver"
              className="w-full p-3 bg-gray-50 dark:bg-gray-900/50 text-xs rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Subscription Audit Log Timeline */}
          {auditLogs.length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-gray-400" />
                Subscription Audit History
              </h4>
              <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                {auditLogs.map(log => (
                  <div key={log._id} className="p-2.5 bg-gray-50 dark:bg-gray-900/60 rounded-xl text-[11px] border border-gray-100 dark:border-gray-800 flex justify-between items-start">
                    <div>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 capitalize">{log.action.replace(/_/g, ' ')}</span>
                      <p className="text-gray-500">{log.reason || 'No reason specified'}</p>
                    </div>
                    <div className="text-right text-[10px] text-gray-400">
                      <span>{log.performedBy}</span>
                      <br />
                      <span>{new Date(log.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Apply Subscription Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
