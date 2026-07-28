"use client";

import React, { useState } from 'react';
import { X, IndianRupee, AlertCircle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';

interface WalletAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: any;
  onSuccess: () => void;
}

const WalletAdjustmentModal: React.FC<WalletAdjustmentModalProps> = ({
  isOpen,
  onClose,
  provider,
  onSuccess
}) => {
  const [action, setAction] = useState<'Wallet Credit' | 'Wallet Debit'>('Wallet Credit');
  const [amount, setAmount] = useState<number | ''>('');
  const [reason, setReason] = useState<string>('Promotional Credit');
  const [remarks, setRemarks] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  if (!isOpen || !provider) return null;

  const isHighValue = Number(amount) > 5000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0 || !reason || !remarks.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all mandatory fields: Amount (>0), Reason, and Remarks.' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API_URL}/providers/admin/wallet-adjustment`,
        {
          providerId: provider._id,
          action,
          amount: Number(amount),
          reason,
          remarks
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.pendingApproval) {
        setMessage({ type: 'warning', text: res.data.message });
      } else {
        setMessage({ type: 'success', text: res.data.message || 'Wallet balance updated successfully!' });
      }

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.message || 'Failed to submit wallet adjustment' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-gray-900 via-slate-800 to-gray-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
              <IndianRupee size={20} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Wallet Adjustment</h2>
              <p className="text-xs text-gray-300 font-medium">Expert: {provider.user_id?.name || 'Service Expert'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {message.text && (
            <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 border ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : message.type === 'warning'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              {message.type === 'success' ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
              <span>{message.text}</span>
            </div>
          )}

          {/* Action Type */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">Adjustment Action</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAction('Wallet Credit')}
                className={`py-2.5 text-xs font-black rounded-xl border transition-all ${
                  action === 'Wallet Credit'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                + Credit Wallet
              </button>
              <button
                type="button"
                onClick={() => setAction('Wallet Debit')}
                className={`py-2.5 text-xs font-black rounded-xl border transition-all ${
                  action === 'Wallet Debit'
                    ? 'bg-red-600 text-white border-red-600 shadow-md'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                - Debit Wallet
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Amount (₹) *</label>
            <input
              type="number"
              min="1"
              required
              placeholder="e.g. 500"
              value={amount}
              onChange={e => setAmount(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-black text-gray-900 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* High Value Alert Notice */}
          {isHighValue && (
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-center gap-2 text-amber-800 text-[11px] font-bold">
              <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
              <span>High-Value Alert: Adjustments over ₹5,000 require Finance Manager / Super Admin approval.</span>
            </div>
          )}

          {/* Reason Selector */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Reason (Mandatory) *</label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:border-emerald-500"
            >
              <option value="Promotional Credit">Promotional Credit</option>
              <option value="Service Compensation">Service Compensation</option>
              <option value="Goodwill Adjustment">Goodwill Adjustment</option>
              <option value="Penalty Deduction">Penalty Deduction</option>
              <option value="Manual Correction">Manual Correction</option>
              <option value="COD Remittance Adjust">COD Remittance Adjust</option>
              <option value="Other">Other (Require Remarks)</option>
            </select>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Mandatory Audit Remarks *</label>
            <textarea
              rows={3}
              required
              placeholder="Enter specific audit notes explaining this balance change..."
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium text-gray-900 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 uppercase tracking-wider"
            >
              {submitting && <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />}
              Confirm Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WalletAdjustmentModal;
