"use client";

import React, { useState, useEffect } from 'react';
import {
  Wallet, ArrowUpRight, Clock, AlertTriangle, CheckCircle2, XCircle,
  Download, RefreshCcw, Search, Filter, ShieldAlert, Building2, User, FileSpreadsheet, X, Calendar
} from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';

export default function AdminSettlementsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({
    totalPendingHold: 0,
    totalReadyForPayout: 0,
    totalPaid: 0,
    totalCodOutstanding: 0,
    overdueCod: 0,
    failedPayouts: 0,
  });
  const [settlements, setSettlements] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<any>(null);
  const [period, setPeriod] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  useEffect(() => {
    fetchSettlements();
  }, []);

  const fetchSettlements = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || localStorage.getItem('jwt');
      const response = await axios.get(`${API_URL}/providers/admin/settlements`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data) {
        setStats(response.data.stats || {});
        setSettlements(Array.isArray(response.data.settlements) ? response.data.settlements : []);
      }
    } catch (err: any) {
      console.warn('Error fetching settlements:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'hold' | 'retry') => {
    try {
      setActionLoadingId(id);
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || localStorage.getItem('jwt');
      await axios.post(
        `${API_URL}/providers/admin/settlements/${id}/action`,
        { action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchSettlements();
    } catch (err: any) {
      alert('Action failed: ' + (err?.response?.data?.message || err.message));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReleasePayout = async (id: string) => {
    if (!window.confirm('Are you sure you want to trigger payout release for this settlement?')) return;
    try {
      setActionLoadingId(id);
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || localStorage.getItem('jwt');
      const res = await axios.post(
        `${API_URL}/providers/admin/settlements/${id}/release-payout`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(res.data?.message || 'Payout released successfully');
      await fetchSettlements();
    } catch (err: any) {
      alert('Payout release failed: ' + (err?.response?.data?.message || err.message));
    } finally {
      setActionLoadingId(null);
    }
  };

  // ponytail: Native browser Blob CSV Export (zero dependencies required)
  const exportCsv = () => {
    if (settlements.length === 0) return;

    const headers = ['Booking ID', 'Payment Type', 'Gross Amount (₹)', 'Commission (₹)', 'GST (₹)', 'Net Payable (₹)', 'Status', 'Hold Ends / Due', 'Paid At'];
    const rows = settlements.map(s => [
      s.booking_display_id || s.booking_id,
      (s.payment_type || 'online').toUpperCase(),
      s.gross_amount || 0,
      s.commission_amount || 0,
      s.gst_on_commission || 0,
      s.net_payable_amount || 0,
      s.status,
      s.hold_ends_at ? new Date(s.hold_ends_at).toLocaleDateString() : 'N/A',
      s.paid_at ? new Date(s.paid_at).toLocaleDateString() : 'Unpaid'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `settlements_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredSettlements = settlements.filter(s => {
    // 1. Period filter
    if (period !== 'all') {
      const now = new Date();
      const itemTime = new Date(s.createdAt || s.updatedAt).getTime();

      if (period === 'today') {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        if (itemTime < todayStart) return false;
      } else if (period === '7days') {
        const cutoff = new Date(now).setDate(now.getDate() - 7);
        if (itemTime < cutoff) return false;
      } else if (period === '30days') {
        const cutoff = new Date(now).setDate(now.getDate() - 30);
        if (itemTime < cutoff) return false;
      } else if (period === 'custom') {
        const start = fromDate ? new Date(fromDate + "T00:00:00").getTime() : null;
        const end = toDate ? new Date(toDate + "T23:59:59.999").getTime() : null;
        if (start && itemTime < start) return false;
        if (end && itemTime > end) return false;
      }
    }

    // 2. Tab filter
    const matchTab =
      activeTab === 'All' ||
      (activeTab === 'pending_hold' && s.status === 'pending_hold') ||
      (activeTab === 'ready_for_payout' && s.status === 'ready_for_payout') ||
      (activeTab === 'paid' && s.status === 'paid') ||
      (activeTab === 'cod_pending' && s.status === 'cod_pending') ||
      (activeTab === 'held_by_admin' && s.status === 'held_by_admin') ||
      (activeTab === 'failed' && s.status === 'failed');

    // 3. Search filter
    const q = searchTerm.toLowerCase();
    const matchSearch =
      !q ||
      String(s.booking_display_id || s.booking_id).toLowerCase().includes(q) ||
      String(s.provider_id?.name || s.provider_id?.bankDetails?.accountHolderName || '').toLowerCase().includes(q) ||
      String(s.service_name || s.variant_name || '').toLowerCase().includes(q) ||
      String(s.status).toLowerCase().includes(q) ||
      String(s.payment_type).toLowerCase().includes(q);

    return matchTab && matchSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Page Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            Settlement & <span className="text-blue-600">Payout Engine</span>
          </h1>
          <p className="text-xs font-bold text-gray-500 mt-1">
            Automated double-entry platform settlement, commission distribution, and provider bank payouts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSettlements}
            className="p-3 bg-white border border-gray-100 hover:border-gray-200 rounded-2xl text-gray-600 shadow-xs transition-all"
            title="Refresh Settlements"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-5 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-sm transition-all"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pending Hold (3-Day)</span>
            <Clock size={18} />
          </div>
          <p className="text-2xl font-black text-gray-900">₹{stats.totalPendingHold?.toLocaleString('en-IN') || 0}</p>
          <p className="text-[9px] font-bold text-gray-400">Escrow hold before release</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-blue-100 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-blue-600">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ready For Payout</span>
            <ArrowUpRight size={18} />
          </div>
          <p className="text-2xl font-black text-blue-600">₹{stats.totalReadyForPayout?.toLocaleString('en-IN') || 0}</p>
          <p className="text-[9px] font-bold text-blue-400">Verified & approved for transfer</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-green-100 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-green-600">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Paid Out</span>
            <CheckCircle2 size={18} />
          </div>
          <p className="text-2xl font-black text-green-600">₹{stats.totalPaid?.toLocaleString('en-IN') || 0}</p>
          <p className="text-[9px] font-bold text-green-500">Transferred to provider bank</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-purple-100 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-purple-600">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">COD Dues Outstanding</span>
            <Wallet size={18} />
          </div>
          <p className="text-2xl font-black text-purple-600">₹{stats.totalCodOutstanding?.toLocaleString('en-IN') || 0}</p>
          <p className="text-[9px] font-bold text-purple-400">Commission owed by providers</p>
        </div>
      </div>

      {/* ━━━ Period Filter Bar ━━━ */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <Calendar size={16} />
          </div>
          <span className="text-xs font-black text-gray-900 uppercase tracking-wider">Select Period:</span>
          <div className="flex flex-wrap items-center gap-1.5 ml-2">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: '7days', label: '7 Days' },
              { id: '30days', label: '30 Days' },
              { id: 'custom', label: 'Custom Range' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  period === p.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-600"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-600"
              />
            </div>
            {(fromDate || toDate) && (
              <button
                onClick={() => { setFromDate(''); setToDate(''); }}
                className="text-[10px] font-black text-blue-600 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filter Tabs & Search */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by Booking ID or status..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-800 shadow-xs focus:outline-none focus:border-blue-200"
            />
          </div>

          <div className="flex border-b border-gray-100 overflow-x-auto w-full sm:w-auto">
            {[
              { id: 'All', label: 'All' },
              { id: 'pending_hold', label: 'Pending Hold' },
              { id: 'ready_for_payout', label: 'Ready' },
              { id: 'paid', label: 'Paid' },
              { id: 'cod_pending', label: 'COD Dues' },
              { id: 'held_by_admin', label: 'Held' },
              { id: 'failed', label: 'Failed' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 px-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
                  activeTab === tab.id ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Settlements Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="px-5 py-4">Booking ID</th>
                <th className="px-5 py-4">Service Taken</th>
                <th className="px-5 py-4">Provider</th>
                <th className="px-5 py-4">Type</th>
                <th className="px-5 py-4">Gross Amount</th>
                <th className="px-5 py-4">Commission</th>
                <th className="px-5 py-4">GST</th>
                <th className="px-5 py-4">Net Payable</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-xs">
              {filteredSettlements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-gray-400 font-bold">
                    No settlement records found.
                  </td>
                </tr>
              ) : (
                filteredSettlements.map(s => (
                  <tr key={s._id} className="hover:bg-blue-50/20 transition-colors cursor-pointer" onClick={() => setSelectedSettlement(s)}>
                    <td className="px-5 py-4 font-black text-gray-900">
                      {s.booking_display_id || s.booking_id}
                    </td>
                    <td className="px-5 py-4 max-w-[150px]">
                      <span className="inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-lg text-[10px] truncate max-w-full" title={s.service_name || s.variant_name || 'Home Service'}>
                        🛠️ {s.service_name || s.variant_name || 'Home Service'}
                      </span>
                    </td>
                    <td className="px-5 py-4 max-w-[150px]">
                      <p className="font-bold text-gray-800 truncate">{s.provider_id?.name || s.provider_id?.bankDetails?.accountHolderName || s.provider_id?.businessName || (s.provider_id?.provider_code ? `Provider ${s.provider_id.provider_code}` : 'Unknown Provider')}</p>
                      <p className="text-[9px] font-bold text-gray-400 mt-0.5">ID: {s.provider_id?.provider_code || String(s.provider_id?._id || s.provider_id || '').slice(-8).toUpperCase()}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        s.payment_type === 'online' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-purple-50 text-purple-600 border border-purple-100'
                      }`}>
                        {s.payment_type}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-bold text-gray-900">₹{s.gross_amount}</td>
                    <td className="px-5 py-4 font-bold text-gray-500">₹{s.commission_amount}</td>
                    <td className="px-5 py-4 font-bold text-gray-500">₹{s.gst_on_commission}</td>
                    <td className="px-5 py-4 font-black text-green-600">
                      {s.payment_type === 'online' ? `₹${s.net_payable_amount}` : `₹${s.cod_due_amount} (COD Due)`}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider ${
                        s.status === 'paid' ? 'bg-green-100 text-green-700' :
                        s.status === 'ready_for_payout' ? 'bg-blue-100 text-blue-700' :
                        s.status === 'pending_hold' ? 'bg-amber-100 text-amber-700' :
                        s.status === 'cod_pending' ? 'bg-purple-100 text-purple-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {s.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {s.status === 'ready_for_payout' && (
                          <button
                            onClick={() => handleReleasePayout(s._id)}
                            disabled={actionLoadingId === s._id}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-2xs"
                          >
                            Release Payout
                          </button>
                        )}

                        {s.status === 'pending_hold' && (
                          <button
                            onClick={() => handleAction(s._id, 'approve')}
                            disabled={actionLoadingId === s._id}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                          >
                            Approve Early
                          </button>
                        )}

                        {s.status === 'failed' && (
                          <button
                            onClick={() => handleAction(s._id, 'retry')}
                            disabled={actionLoadingId === s._id}
                            className="px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* ━━━ Settlement Timeline Drawer ━━━ */}
      {selectedSettlement && (
        <div className="fixed inset-0 bg-black/30 z-50 flex justify-end" onClick={() => setSelectedSettlement(null)}>
          <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-gray-900">Settlement Timeline</h3>
              <button onClick={() => setSelectedSettlement(null)} className="p-2 hover:bg-gray-100 rounded-xl"><X size={16} /></button>
            </div>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-gray-500">Booking</span>
                <span className="font-black text-gray-900">{selectedSettlement.booking_display_id}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-bold text-gray-500">Type</span>
                <span className={`font-black uppercase ${selectedSettlement.payment_type === 'cod' ? 'text-purple-600' : 'text-blue-600'}`}>{selectedSettlement.payment_type}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-bold text-gray-500">Gross Amount</span>
                <span className="font-black text-gray-900">₹{selectedSettlement.gross_amount?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-bold text-gray-500">Commission</span>
                <span className="font-bold text-gray-600">₹{selectedSettlement.commission_amount?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-bold text-gray-500">Net Payable</span>
                <span className="font-black text-emerald-600">₹{selectedSettlement.net_payable_amount?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-bold text-gray-500">Status</span>
                <span className="font-black text-gray-900 uppercase">{selectedSettlement.status?.replace(/_/g, ' ')}</span>
              </div>
              {selectedSettlement.utr_number && (
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-gray-500">UTR</span>
                  <span className="font-bold text-gray-700">{selectedSettlement.utr_number}</span>
                </div>
              )}
            </div>
            <h4 className="text-xs font-black text-gray-900 mb-4 uppercase tracking-wider">Audit Trail</h4>
            <div className="relative pl-6 border-l-2 border-gray-200 space-y-6">
              {(selectedSettlement.audit_trail || []).map((entry: any, idx: number) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[25px] w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
                  <p className="text-xs font-black text-gray-900">{entry.action?.replace(/_/g, ' ')}</p>
                  <p className="text-[10px] font-bold text-gray-400">{entry.notes}</p>
                  <p className="text-[9px] font-bold text-gray-300 mt-0.5">
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleString('en-IN') : '—'}
                    {entry.performed_by && entry.performed_by !== 'system' ? ` • by ${entry.performed_by}` : ''}
                  </p>
                </div>
              ))}
              {(!selectedSettlement.audit_trail || selectedSettlement.audit_trail.length === 0) && (
                <p className="text-xs text-gray-400 font-bold">No audit trail recorded for this settlement.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
