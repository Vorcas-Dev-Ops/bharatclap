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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [batchLoading, setBatchLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchSettlements();
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || localStorage.getItem('jwt');
    if (token && token !== 'null' && token !== 'undefined') {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  };

  const fetchSettlements = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/providers/admin/settlements`, {
        headers: getAuthHeaders(),
      });

      if (response.data) {
        setStats(response.data.stats || {});
        setSettlements(Array.isArray(response.data.settlements) ? response.data.settlements : []);
        setSelectedIds([]);
      }
    } catch (err: any) {
      console.warn('Error fetching settlements:', err?.response?.data || err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
  };

  const toggleSelectAllEligible = () => {
    const readyIds = filteredSettlements.filter(s => s.status === 'ready_for_payout').map(s => s._id);
    if (selectedIds.length === readyIds.length && readyIds.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(readyIds);
    }
  };

  const handleBatchPayoutSubmit = async () => {
    if (selectedIds.length === 0) return;
    try {
      setBatchLoading(true);
      const res = await axios.post(
        `${API_URL}/providers/admin/settlements/batch-payout`,
        { settlement_ids: selectedIds },
        { headers: getAuthHeaders() }
      );

      alert(res.data?.message || `Batch processing initiated for ${selectedIds.length} settlements!`);
      setShowBatchModal(false);
      setSelectedIds([]);
      await fetchSettlements();
    } catch (err: any) {
      alert('Batch payout processing failed: ' + (err?.response?.data?.message || err.message));
    } finally {
      setBatchLoading(false);
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'hold' | 'retry') => {
    try {
      setActionLoadingId(id);
      await axios.post(
        `${API_URL}/providers/admin/settlements/${id}/action`,
        { action },
        { headers: getAuthHeaders() }
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
      const res = await axios.post(
        `${API_URL}/providers/admin/settlements/${id}/release-payout`,
        {},
        { headers: getAuthHeaders() }
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
    // ponytail: Compact layout to eliminate empty space and slide elements left
    <div className="space-y-4 animate-in fade-in duration-500 pb-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Settlement & <span className="text-blue-600">Payout Engine</span>
          </h1>
          <p className="text-[11px] font-bold text-gray-500 mt-0.5">
            Automated double-entry platform settlement, commission distribution, and provider bank payouts
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={() => setShowBatchModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-xs transition-all animate-pulse"
            >
              <ArrowUpRight size={14} />
              Process Selected Batch ({selectedIds.length})
            </button>
          )}
          <button
            onClick={fetchSettlements}
            className="p-2 bg-white border border-gray-200 hover:border-gray-300 rounded-xl text-gray-600 shadow-2xs transition-all"
            title="Refresh Settlements"
          >
            <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-xs transition-all"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pending Hold (3-Day)</span>
            <Clock size={16} />
          </div>
          <p className="text-xl font-black text-gray-900">₹{stats.totalPendingHold?.toLocaleString('en-IN') || 0}</p>
          <p className="text-[9px] font-bold text-gray-400">Escrow hold before release</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-blue-100 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-blue-600">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ready For Payout</span>
            <ArrowUpRight size={16} />
          </div>
          <p className="text-xl font-black text-blue-600">₹{stats.totalReadyForPayout?.toLocaleString('en-IN') || 0}</p>
          <p className="text-[9px] font-bold text-blue-400">Verified & approved for transfer</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-green-100 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-green-600">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Paid Out</span>
            <CheckCircle2 size={16} />
          </div>
          <p className="text-xl font-black text-green-600">₹{stats.totalPaid?.toLocaleString('en-IN') || 0}</p>
          <p className="text-[9px] font-bold text-green-500">Transferred to provider bank</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-purple-100 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-purple-600">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">COD Dues Outstanding</span>
            <Wallet size={16} />
          </div>
          <p className="text-xl font-black text-purple-600">₹{stats.totalCodOutstanding?.toLocaleString('en-IN') || 0}</p>
          <p className="text-[9px] font-bold text-purple-400">Commission owed by providers</p>
        </div>
      </div>

      {/* ━━━ Period Filter Bar (Compact Left Aligned) ━━━ */}
      <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-2xs flex flex-wrap items-center justify-start gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
            <Calendar size={14} />
          </div>
          <span className="text-xs font-black text-gray-900 uppercase tracking-wider">Period:</span>
          <div className="flex flex-wrap items-center gap-1 ml-1">
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
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  period === p.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2 animate-in fade-in duration-200 ml-auto sm:ml-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="px-2.5 py-1 text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="px-2.5 py-1 text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
            {(fromDate || toDate) && (
              <button
                onClick={() => { setFromDate(''); setToDate(''); }}
                className="text-[10px] font-black text-blue-600 hover:underline px-1"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filter Tabs & Search (Slid Left & Compact) */}
      <div className="flex flex-col sm:flex-row gap-3 justify-start items-stretch sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="Search Booking ID or status..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 shadow-2xs focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex border-b border-gray-100 overflow-x-auto">
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
              className={`pb-2 px-3 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
                activeTab === tab.id ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Settlements Table (Compact & Full Actions Visibility) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-x-auto">
        <table className="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100 text-[10px] font-black uppercase tracking-wider text-gray-400">
              <th className="pl-2 pr-1 py-2 w-6">
                <input
                  type="checkbox"
                  onChange={toggleSelectAllEligible}
                  checked={
                    selectedIds.length > 0 &&
                    selectedIds.length === filteredSettlements.filter(s => s.status === 'ready_for_payout').length
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </th>
              <th className="px-1 py-2">Booking ID</th>
              <th className="px-1 py-2">Service</th>
              <th className="px-1 py-2">Provider</th>
              <th className="px-1 py-2">Type</th>
              <th className="px-1 py-2">Gross</th>
              <th className="px-1 py-2">Comm.</th>
              <th className="px-1 py-2">GST</th>
              <th className="px-1 py-2">Net Payable</th>
              <th className="px-1 py-2">Status</th>
              <th className="pr-2 pl-1 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-[11px]">
            {filteredSettlements.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center py-6 text-gray-400 font-bold">
                  No settlement records found.
                </td>
              </tr>
            ) : (
              filteredSettlements.map(s => (
                <tr key={s._id} className={`hover:bg-blue-50/20 transition-colors cursor-pointer ${selectedIds.includes(s._id) ? 'bg-blue-50/40' : ''}`} onClick={() => setSelectedSettlement(s)}>
                  <td className="pl-2 pr-1 py-1.5" onClick={e => e.stopPropagation()}>
                    {s.status === 'ready_for_payout' ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(s._id)}
                        onChange={e => toggleSelectId(s._id, e as any)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    ) : (
                      <span className="w-3 h-3 inline-block" />
                    )}
                  </td>
                  <td className="px-1 py-1.5 font-black text-gray-900 max-w-[110px] truncate" title={s.booking_display_id || s.booking_id}>
                    {s.booking_display_id || s.booking_id}
                  </td>
                  <td className="px-1 py-1.5 max-w-[95px]">
                    <span className="inline-block font-bold text-purple-700 bg-purple-50 border border-purple-100 px-1 py-0.5 rounded text-[9px] truncate max-w-full" title={s.service_name || s.variant_name || 'Home Service'}>
                      🛠️ {s.service_name || s.variant_name || 'Home Service'}
                    </span>
                  </td>
                  <td className="px-1 py-1.5 max-w-[105px]">
                    <p className="font-bold text-gray-800 truncate" title={s.provider_id?.name || s.provider_id?.bankDetails?.accountHolderName || 'Provider'}>
                      {s.provider_id?.name || s.provider_id?.bankDetails?.accountHolderName || s.provider_id?.businessName || 'Provider'}
                    </p>
                    <p className="text-[9px] font-bold text-gray-400 truncate">
                      ID: {String(s.provider_id?.provider_code || s.provider_id?._id || s.provider_id || '').slice(-8).toUpperCase()}
                    </p>
                  </td>
                  <td className="px-1 py-1.5">
                    <span className={`px-1 py-0.5 rounded text-[8px] font-black uppercase ${
                      s.payment_type === 'online' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-purple-50 text-purple-600 border border-purple-100'
                    }`}>
                      {s.payment_type}
                    </span>
                  </td>
                  <td className="px-1 py-1.5 font-bold text-gray-900 whitespace-nowrap">₹{s.gross_amount}</td>
                  <td className="px-1 py-1.5 font-bold text-gray-500 whitespace-nowrap">₹{s.commission_amount}</td>
                  <td className="px-1 py-1.5 font-bold text-gray-500 whitespace-nowrap">₹{s.gst_on_commission}</td>
                  <td className="px-1 py-1.5 whitespace-nowrap">
                    <span className="font-black text-green-600 block">
                      ₹{s.payment_type === 'online' ? s.net_payable_amount : s.cod_due_amount}
                    </span>
                    {s.payment_type === 'cod' && (
                      <span className="text-[8px] font-bold text-purple-600 block leading-tight">COD Due</span>
                    )}
                  </td>
                  <td className="px-1 py-1.5">
                    <span className={`px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-wider whitespace-nowrap ${
                      s.status === 'paid' ? 'bg-green-100 text-green-700' :
                      s.status === 'ready_for_payout' ? 'bg-blue-100 text-blue-700' :
                      s.status === 'pending_hold' ? 'bg-amber-100 text-amber-700' :
                      s.status === 'cod_pending' ? 'bg-purple-100 text-purple-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {s.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="pr-2 pl-1 py-1.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      {s.status === 'ready_for_payout' && (
                        <button
                          onClick={() => handleReleasePayout(s._id)}
                          disabled={actionLoadingId === s._id}
                          className="px-2 py-0.5 bg-green-600 hover:bg-green-700 text-white rounded text-[9px] font-black uppercase tracking-wider transition-all shadow-2xs"
                        >
                          Release
                        </button>
                      )}

                      {s.status === 'pending_hold' && (
                        <button
                          onClick={() => handleAction(s._id, 'approve')}
                          disabled={actionLoadingId === s._id}
                          className="px-2 py-0.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded text-[9px] font-black uppercase tracking-wider transition-all"
                        >
                          Approve Early
                        </button>
                      )}

                      {s.status === 'failed' && (
                        <button
                          onClick={() => handleAction(s._id, 'retry')}
                          disabled={actionLoadingId === s._id}
                          className="px-2 py-0.5 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded text-[9px] font-black uppercase tracking-wider transition-all"
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

      {/* ━━━ Batch Payout Confirmation Modal ━━━ */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowBatchModal(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <ArrowUpRight size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Confirm Batch Payout</h3>
                  <p className="text-xs text-gray-500 font-bold">RazorpayX Money Movement</p>
                </div>
              </div>
              <button onClick={() => setShowBatchModal(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                <X size={18} />
              </button>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl space-y-3">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-gray-500">Selected Providers:</span>
                <span className="font-black text-gray-900">{selectedIds.length} Settlements</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-bold text-gray-500">Total Net Payout:</span>
                <span className="font-black text-emerald-600 text-sm">
                  ₹{settlements.filter(s => selectedIds.includes(s._id)).reduce((sum, s) => sum + s.net_payable_amount, 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-bold text-gray-500">Execution Mode:</span>
                <span className="font-bold text-blue-600">Asynchronous Batch (Atomic Claim)</span>
              </div>
            </div>

            <p className="text-[11px] font-bold text-gray-400">
              Each settlement will be atomically claimed (`ready_for_payout` → `processing`) with a permanent idempotency key (`bharatclap:settlement:id:payout`). Zero duplicate transfer risk.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowBatchModal(false)}
                disabled={batchLoading}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl text-xs font-black uppercase tracking-wider transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchPayoutSubmit}
                disabled={batchLoading}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2"
              >
                {batchLoading ? <RefreshCcw size={14} className="animate-spin" /> : <ArrowUpRight size={14} />}
                Confirm & Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
