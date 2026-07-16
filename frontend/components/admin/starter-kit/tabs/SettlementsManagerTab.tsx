"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Banknote, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  ShieldAlert,
  Search,
  RefreshCw,
  Eye,
  AlertCircle
} from 'lucide-react';
import { authFetch } from '@/utils/authFetch';
import { API_URL } from '@/config/api';
import { message } from 'antd';

interface SettlementDetails {
  _id: string;
  provider_id: {
    _id: string;
    bankDetails?: {
      accountHolderName: string;
      accountNumber: string;
      ifscCode: string;
      bankName: string;
      status: string;
    };
    user_id: string;
    codDueBalance: number;
    walletBalance: number;
    reservedBalance: number;
    creditLimit: number;
    availableCredit: number;
  };
  booking_id: string;
  booking_display_id: string;
  payment_type: 'online' | 'cod';
  gross_amount: number;
  commission_amount: number;
  gst_on_commission: number;
  tds_amount: number;
  tcs_amount: number;
  net_payable_amount: number;
  cod_due_amount: number;
  status: 'pending_hold' | 'ready_for_payout' | 'processing' | 'paid' | 'failed' | 'disputed' | 'held_by_admin' | 'cod_pending' | 'cod_settled';
  hold_ends_at?: string;
  cod_due_by?: string;
  paid_at?: string;
  settlement_batch_id?: string;
  payout_reference_id?: string;
  transaction_reference?: string;
  failure_reason?: string;
}

interface Stats {
  totalPendingHold: number;
  totalReadyForPayout: number;
  totalPaid: number;
  totalCodOutstanding: number;
  overdueCod: number;
  failedPayouts: number;
}

export default function SettlementsManagerTab() {
  const [settlements, setSettlements] = useState<SettlementDetails[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPendingHold: 0,
    totalReadyForPayout: 0,
    totalPaid: 0,
    totalCodOutstanding: 0,
    overdueCod: 0,
    failedPayouts: 0
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [messageApi, contextHolder] = message.useMessage();

  const fetchSettlements = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`${API_URL}/providers/admin/settlements`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setSettlements(data.settlements);
      }
    } catch (err) {
      console.error(err);
      messageApi.error("Failed to fetch settlements log");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettlements();
  }, []);

  const handleAction = async (id: string, action: 'approve' | 'hold' | 'retry') => {
    try {
      const res = await authFetch(`${API_URL}/providers/admin/settlements/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        messageApi.success(`Settlement status updated successfully: ${action}`);
        fetchSettlements();
      } else {
        const errData = await res.json();
        messageApi.error(errData.message || 'Action failed');
      }
    } catch (err) {
      messageApi.error('Error applying action');
    }
  };

  const filteredSettlements = useMemo(() => {
    return settlements.filter((s) => {
      const matchesSearch = s.booking_display_id.toLowerCase().includes(search.toLowerCase());
      if (statusFilter === 'all') return matchesSearch;
      return matchesSearch && s.status === statusFilter;
    });
  }, [settlements, search, statusFilter]);

  return (
    <div className="space-y-6">
      {contextHolder}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Pending Hold</span>
            <span className="text-xl font-black text-slate-800 mt-1 block">₹{stats.totalPendingHold}</span>
            <span className="text-[9px] text-amber-500 font-bold block mt-1">Escrow held</span>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-500 rounded-xl">
            <Clock size={16} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Ready Payout</span>
            <span className="text-xl font-black text-slate-800 mt-1 block">₹{stats.totalReadyForPayout}</span>
            <span className="text-[9px] text-emerald-500 font-bold block mt-1">Next batch run</span>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-500 rounded-xl">
            <CheckCircle size={16} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Total Paid</span>
            <span className="text-xl font-black text-slate-800 mt-1 block">₹{stats.totalPaid}</span>
            <span className="text-[9px] text-blue-500 font-bold block mt-1">Direct bank credited</span>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Banknote size={16} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">COD Owed</span>
            <span className="text-xl font-black text-slate-800 mt-1 block">₹{stats.totalCodOutstanding}</span>
            <span className="text-[9px] text-indigo-500 font-bold block mt-1">Partner owed dues</span>
          </div>
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <AlertCircle size={16} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">COD Overdue</span>
            <span className="text-xl font-black text-slate-800 mt-1 block">₹{stats.overdueCod}</span>
            <span className="text-[9px] text-rose-500 font-bold block mt-1">Blocked partners</span>
          </div>
          <div className="p-2.5 bg-rose-50 text-rose-500 rounded-xl">
            <ShieldAlert size={16} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between bg-rose-500 text-white">
          <div>
            <span className="text-rose-100 text-xs font-bold uppercase tracking-wider block">Failed Payouts</span>
            <span className="text-xl font-black text-white mt-1 block">₹{stats.failedPayouts}</span>
            <span className="text-[9px] text-rose-100 font-bold block mt-1">Action needed</span>
          </div>
          <div className="p-2.5 bg-white/20 text-white rounded-xl">
            <AlertTriangle size={16} />
          </div>
        </div>
      </div>

      {/* Toolbar Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search booking ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 transition-all"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {['all', 'pending_hold', 'ready_for_payout', 'paid', 'failed', 'cod_pending', 'cod_settled'].map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                statusFilter === filter
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {filter.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Booking ID</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Type</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Gross Amount</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Platform Commission</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Payout / COD Due</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Payout Batch / Ref</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin h-5 w-5 text-blue-600" />
                      <span className="text-xs font-bold text-slate-500">Loading payout logs...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredSettlements.length > 0 ? (
                filteredSettlements.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5 text-xs font-black text-slate-900">
                      {s.booking_display_id}
                    </td>
                    <td className="px-6 py-5 text-xs font-bold text-slate-600 uppercase">
                      {s.payment_type}
                    </td>
                    <td className="px-6 py-5 text-xs font-black text-slate-800">
                      ₹{s.gross_amount}
                    </td>
                    <td className="px-6 py-5 text-xs font-semibold text-slate-500">
                      ₹{(s.commission_amount + s.gst_on_commission).toFixed(2)}
                    </td>
                    <td className="px-6 py-5 text-xs font-black text-slate-800">
                      {s.payment_type === 'online' ? `₹${s.net_payable_amount.toFixed(2)}` : `₹${s.cod_due_amount.toFixed(2)}`}
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        s.status === 'paid' || s.status === 'cod_settled' ? 'bg-emerald-50 text-emerald-600' :
                        s.status === 'pending_hold' || s.status === 'cod_pending' ? 'bg-amber-50 text-amber-600' :
                        s.status === 'failed' ? 'bg-rose-50 text-rose-600' :
                        'bg-slate-50 text-slate-600'
                      }`}>
                        {s.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      {s.settlement_batch_id ? (
                        <div>
                          <span className="block text-[10px] font-bold text-slate-800">{s.settlement_batch_id}</span>
                          {s.payout_reference_id && (
                            <span className="block text-[8px] font-bold text-slate-400 mt-0.5">{s.payout_reference_id}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-bold">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-1.5">
                        {s.status === 'pending_hold' && (
                          <>
                            <button
                              onClick={() => handleAction(s._id, 'approve')}
                              className="px-2 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 text-[9px] font-black uppercase tracking-wider rounded"
                            >
                              Approve Early
                            </button>
                            <button
                              onClick={() => handleAction(s._id, 'hold')}
                              className="px-2 py-1 bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-black uppercase tracking-wider rounded"
                            >
                              Hold Payout
                            </button>
                          </>
                        )}
                        {s.status === 'failed' && (
                          <button
                            onClick={() => handleAction(s._id, 'retry')}
                            className="px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-100 text-[9px] font-black uppercase tracking-wider rounded flex items-center gap-1"
                          >
                            <RefreshCw size={10} />
                            Retry
                          </button>
                        )}
                        {!['pending_hold', 'failed'].includes(s.status) && (
                          <span className="text-[10px] font-bold text-slate-400">Processed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-bold text-xs">
                    No settlement records found.
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

// Simple loader icon
function Loader2(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
