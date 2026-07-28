"use client";

import React, { useState } from 'react';
import { X, Lock, Unlock, ShieldAlert, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';

interface WalletFreezeModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: any;
  onSuccess: () => void;
}

const WalletFreezeModal: React.FC<WalletFreezeModalProps> = ({
  isOpen,
  onClose,
  provider,
  onSuccess
}) => {
  const isFrozen = provider?.walletStatus === 'frozen_manual' || provider?.walletStatus === 'frozen_auto' || provider?.isWalletBlocked;
  const [reason, setReason] = useState<string>(isFrozen ? 'Investigation Complete' : 'Fraud Investigation');
  const [remarks, setRemarks] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  if (!isOpen || !provider) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || !remarks.trim()) {
      setMessage({ type: 'error', text: 'Please select a Reason and enter mandatory Remarks.' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      const endpoint = isFrozen ? '/providers/admin/unfreeze-wallet' : '/providers/admin/freeze-wallet';
      const res = await axios.post(
        `${API_URL}${endpoint}`,
        {
          providerId: provider._id,
          reason,
          remarks
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage({ type: 'success', text: res.data.message || `Wallet ${isFrozen ? 'unfrozen' : 'frozen'} successfully!` });

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.message || 'Action failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`p-6 text-white flex items-center justify-between ${isFrozen ? 'bg-gradient-to-r from-emerald-800 via-teal-900 to-emerald-800' : 'bg-gradient-to-r from-red-900 via-rose-900 to-red-900'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
              {isFrozen ? <Unlock size={20} className="text-emerald-400" /> : <Lock size={20} className="text-rose-400" />}
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">{isFrozen ? 'Unfreeze Provider Wallet' : 'Freeze Provider Wallet'}</h2>
              <p className="text-xs text-gray-300 font-medium">Expert: {provider.user_id?.name || 'Service Expert'} (Super Admin Only)</p>
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
              message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              {message.type === 'success' ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
              <span>{message.text}</span>
            </div>
          )}

          {/* Warning Banner */}
          {!isFrozen ? (
            <div className="p-3 bg-red-50 rounded-2xl border border-red-200 text-red-800 text-[11px] font-bold">
              ⚠️ Warning: Freezing the wallet will block job dispatch, package purchases, and wallet withdrawals. Immutable audit entry will be logged.
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 text-[11px] font-bold">
              ✅ Unfreezing will restore the wallet to Active status and re-enable job dispatching.
            </div>
          )}

          {/* Mandatory Reason */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Reason (Mandatory) *</label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:border-red-500"
            >
              {!isFrozen ? (
                <>
                  <option value="Fraud Investigation">Fraud Investigation</option>
                  <option value="Payment Dispute">Payment Dispute</option>
                  <option value="Chargeback">Chargeback</option>
                  <option value="Legal Hold">Legal Hold</option>
                  <option value="Security Concern">Security Concern</option>
                  <option value="Compliance Review">Compliance Review</option>
                  <option value="Manual Administrative Action">Manual Administrative Action</option>
                  <option value="Other">Other (Require Remarks)</option>
                </>
              ) : (
                <>
                  <option value="Investigation Complete">Investigation Complete</option>
                  <option value="Dispute Resolved">Dispute Resolved</option>
                  <option value="Legal Clearance">Legal Clearance</option>
                  <option value="Admin Reinstatement">Admin Reinstatement</option>
                </>
              )}
            </select>
          </div>

          {/* Mandatory Remarks */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Mandatory Audit Remarks *</label>
            <textarea
              rows={3}
              required
              placeholder="Enter detailed notes for the immutable audit trail..."
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium text-gray-900 focus:outline-none focus:border-red-500"
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
              className={`px-6 py-2.5 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 uppercase tracking-wider text-white ${
                isFrozen ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {submitting && <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />}
              {isFrozen ? 'Confirm Unfreeze' : 'Confirm Freeze'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WalletFreezeModal;
