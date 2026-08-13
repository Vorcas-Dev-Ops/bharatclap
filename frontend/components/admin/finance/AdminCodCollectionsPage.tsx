"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Banknote, AlertTriangle, CheckCircle2, Clock, Users, RefreshCcw,
  IndianRupee, TrendingUp, ArrowUpRight, Search, Download, Filter,
  Building2, CreditCard, ShieldCheck, XCircle, Calendar, Bell, Send,
  Receipt, Check, ExternalLink, X, Eye, DollarSign
} from "lucide-react";
import axios from "axios";
import { API_URL } from "@/config/api";

export default function AdminCodCollectionsPage() {
  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTab, setFilterTab] = useState<'all' | 'overdue' | 'pending' | 'settled'>('all');
  const [period, setPeriod] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Modals & Action States
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [cashModalProvider, setCashModalProvider] = useState<any>(null);
  const [cashForm, setCashForm] = useState({ amount: '', reference: '', notes: '' });
  const [cashSubmitting, setCashSubmitting] = useState(false);
  const [cashModalError, setCashModalError] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token") || localStorage.getItem("adminToken") || localStorage.getItem("jwt");
      const res = await axios.get(`${API_URL}/providers/admin/settlements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data) {
        setStats(res.data.stats || {});
        setSettlements(Array.isArray(res.data.settlements) ? res.data.settlements : []);
      }
    } catch (err: any) {
      console.warn("Error fetching COD data:", err?.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter settlements by selected time period
  const filteredSettlements = useMemo(() => {
    if (period === 'all') return settlements;
    const now = new Date();

    if (period === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return settlements.filter(s => {
        const d = s.createdAt || s.updatedAt;
        return d && new Date(d).getTime() >= todayStart;
      });
    }

    if (period === '7days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      const cutoff = d.getTime();
      return settlements.filter(s => {
        const itemD = s.createdAt || s.updatedAt;
        return itemD && new Date(itemD).getTime() >= cutoff;
      });
    }

    if (period === '30days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      const cutoff = d.getTime();
      return settlements.filter(s => {
        const itemD = s.createdAt || s.updatedAt;
        return itemD && new Date(itemD).getTime() >= cutoff;
      });
    }

    if (period === 'custom') {
      const start = fromDate ? new Date(fromDate + "T00:00:00").getTime() : null;
      const end = toDate ? new Date(toDate + "T23:59:59.999").getTime() : null;

      return settlements.filter(s => {
        const itemD = s.createdAt || s.updatedAt;
        return itemD && new Date(itemD).getTime() >= (start || 0) && new Date(itemD).getTime() <= (end || Infinity);
      });
    }

    return settlements;
  }, [settlements, period, fromDate, toDate]);

  // Derive COD-specific data & provider breakdown
  const derived = useMemo(() => {
    const now = new Date();
    const codSettlements = filteredSettlements.filter(s => s.payment_type === 'cod');
    const pendingCod = codSettlements.filter(s => s.status === 'cod_pending');
    const settledCod = codSettlements.filter(s => s.status === 'cod_settled');
    const overdueCod = pendingCod.filter(s => s.cod_due_by && new Date(s.cod_due_by) < now);

    const totalCodCollected = codSettlements.reduce((sum, s) => sum + (s.gross_amount || 0), 0);
    const totalCommissionFromCod = codSettlements.reduce((sum, s) => sum + (s.commission_amount || 0) + (s.gst_on_commission || 0), 0);
    const totalCodOutstanding = pendingCod.reduce((sum, s) => sum + (s.cod_due_amount || 0), 0);
    const totalCodDeposited = settledCod.reduce((sum, s) => sum + (s.cod_due_amount || 0), 0);
    const overdueAmount = overdueCod.reduce((sum, s) => sum + (s.cod_due_amount || 0), 0);

    // Online commission
    const onlineSettlements = filteredSettlements.filter(s => s.payment_type === 'online');
    const totalCommissionFromOnline = onlineSettlements.reduce((sum, s) => sum + (s.commission_amount || 0) + (s.gst_on_commission || 0), 0);
    const totalPlatformCommission = totalCommissionFromCod + totalCommissionFromOnline;

    // Per-provider breakdown (Online & COD)
    const providerMap = new Map<string, {
      providerId: string; providerCode: string; providerName: string;
      totalJobs: number; onlineJobs: number; codJobs: number;
      codCollected: number; codDeposited: number; codOutstanding: number;
      commissionEarned: number; overdue: boolean; overdueCount: number;
      dueDeadline: string;
    }>();

    // Map all settlements for provider job counts
    for (const s of filteredSettlements) {
      const pid = String(s.provider_id?._id || s.provider_id);
      const pname = s.provider_id?.name || s.provider_id?.bankDetails?.accountHolderName || s.provider_id?.businessName || (s.provider_id?.provider_code ? `Provider ${s.provider_id.provider_code}` : `Provider ${pid.slice(-6)}`);
      const pcode = s.provider_id?.provider_code || pid.slice(-8).toUpperCase();

      const entry = providerMap.get(pid) || {
        providerId: pid, providerCode: pcode, providerName: pname,
        totalJobs: 0, onlineJobs: 0, codJobs: 0,
        codCollected: 0, codDeposited: 0, codOutstanding: 0,
        commissionEarned: 0, overdue: false, overdueCount: 0,
        dueDeadline: 'Today 7 PM',
      };

      entry.totalJobs += 1;
      if (s.payment_type === 'online') {
        entry.onlineJobs += 1;
      } else {
        entry.codJobs += 1;
        entry.codCollected += s.gross_amount || 0;
        entry.commissionEarned += (s.commission_amount || 0) + (s.gst_on_commission || 0);

        if (s.status === 'cod_settled') {
          entry.codDeposited += s.cod_due_amount || 0;
        } else if (s.status === 'cod_pending') {
          entry.codOutstanding += s.cod_due_amount || 0;
          if (s.cod_due_by && new Date(s.cod_due_by) < now) {
            entry.overdue = true;
            entry.overdueCount += 1;
            entry.dueDeadline = 'OVERDUE';
          }
        }
      }
      providerMap.set(pid, entry);
    }

    let providers = Array.from(providerMap.values()).sort((a, b) => {
      if (a.overdue && !b.overdue) return -1;
      if (!a.overdue && b.overdue) return 1;
      return b.codOutstanding - a.codOutstanding;
    });

    return {
      totalCodJobs: codSettlements.length, pendingCount: pendingCod.length,
      settledCount: settledCod.length, overdueCount: overdueCod.length,
      totalCodCollected, totalCommissionFromCod, totalCodOutstanding,
      totalCodDeposited, overdueAmount, totalPlatformCommission,
      totalCommissionFromOnline, onlineJobs: onlineSettlements.length,
      providers,
    };
  }, [filteredSettlements]);

  // Filter providers
  const filteredProviders = useMemo(() => {
    let list = derived.providers;
    if (filterTab === 'overdue') list = list.filter(p => p.overdue);
    if (filterTab === 'pending') list = list.filter(p => p.codOutstanding > 0);
    if (filterTab === 'settled') list = list.filter(p => p.codOutstanding === 0 && p.codJobs > 0);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(p => p.providerName.toLowerCase().includes(q) || p.providerCode.toLowerCase().includes(q));
    }
    return list;
  }, [derived.providers, filterTab, searchTerm]);

  // Admin Actions
  const handleSendReminder = async (providerId: string, name: string) => {
    try {
      setActionLoadingId(providerId);
      const token = localStorage.getItem("token") || localStorage.getItem("adminToken") || localStorage.getItem("jwt");
      await axios.post(`${API_URL}/providers/admin/send-cod-reminder/${providerId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setToastMessage(`COD Deposit Reminder sent successfully to ${name}!`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      alert("Failed to send reminder: " + (err?.response?.data?.message || err.message));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRequestDeposit = async (providerId: string, name: string) => {
    try {
      setActionLoadingId(providerId);
      const token = localStorage.getItem("token") || localStorage.getItem("adminToken") || localStorage.getItem("jwt");
      await axios.post(`${API_URL}/providers/admin/request-cod-deposit/${providerId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setToastMessage(`Formal Action-Required COD Deposit Request sent to ${name}!`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      alert("Failed to request deposit: " + (err?.response?.data?.message || err.message));
    } finally {
      setActionLoadingId(null);
    }
  };

  const openCashModal = (provider: any) => {
    setCashModalProvider(provider);
    setCashModalError(null);
    setCashForm({
      amount: String(provider.codOutstanding || 0),
      reference: `CASH-HUB-${Date.now().toString().slice(-6)}`,
      notes: 'Recorded at BharatClap Central Hub',
    });
  };

  const handleRecordCashSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashModalProvider) return;
    try {
      setCashSubmitting(true);
      setCashModalError(null);
      const token = localStorage.getItem("token") || localStorage.getItem("adminToken") || localStorage.getItem("jwt");
      const res = await axios.post(`${API_URL}/providers/admin/record-cash-deposit/${cashModalProvider.providerId}`, {
        amount: Number(cashForm.amount),
        reference: cashForm.reference,
        notes: cashForm.notes,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data?.receipt) {
        setReceiptData(res.data.receipt);
        setCashModalProvider(null);
        fetchData();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to record cash deposit.';
      setCashModalError(msg);
    } finally {
      setCashSubmitting(false);
    }
  };

  const fmt = (val: number) => {
    const num = Number(val || 0);
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
    return `₹${Number(num.toFixed(2)).toLocaleString("en-IN")}`;
  };

  const fmtCurr = (val: number) => {
    const num = Number(val || 0);
    return `₹${Number(num.toFixed(2)).toLocaleString("en-IN")}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-600 mb-4" />
        <p className="text-gray-400 font-bold text-sm">Loading COD Collections Workflow...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            COD <span className="text-purple-600">Collection & Deposit Workflow</span>
          </h1>
          <p className="text-xs font-bold text-gray-500 mt-1">
            Enterprise COD collection, automated notifications, online pay link, hub cash deposits & receipts
          </p>
        </div>
        <button onClick={fetchData} className="p-3 bg-white border border-gray-100 hover:border-gray-200 rounded-2xl text-gray-600 shadow-xs transition-all" title="Refresh">
          <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-600 hover:text-emerald-900"><X size={16} /></button>
        </div>
      )}

      {/* ━━━ Period Filter Bar ━━━ */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
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
                    ? 'bg-purple-600 text-white shadow-xs'
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
                className="px-3 py-1.5 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-purple-600"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-purple-600"
              />
            </div>
            {(fromDate || toDate) && (
              <button
                onClick={() => { setFromDate(''); setToDate(''); }}
                className="text-[10px] font-black text-purple-600 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* ━━━ KPI Cards ━━━ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        {[
          { label: "Total COD Jobs", value: String(derived.totalCodJobs), icon: Banknote, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
          { label: "COD Collected", value: fmt(derived.totalCodCollected), icon: IndianRupee, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
          { label: "COD Deposited", value: fmt(derived.totalCodDeposited), icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
          { label: "COD Outstanding", value: fmt(derived.totalCodOutstanding), icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
          { label: "Overdue", value: `${derived.overdueCount} (${fmt(derived.overdueAmount)})`, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", border: "border-red-100" },
          { label: "COD Commission", value: fmt(derived.totalCommissionFromCod), icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
          { label: "Online Commission", value: fmt(derived.totalCommissionFromOnline), icon: CreditCard, color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-100" },
          { label: "Total Platform Earned", value: fmt(derived.totalPlatformCommission), icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
        ].map(({ label, value, icon: Icon, color, bg, border }) => (
          <div key={label} className={`bg-white p-4 rounded-2xl border ${border} shadow-xs group hover:shadow-md transition-all`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-tight">{label}</span>
              <div className={`p-1.5 ${bg} ${color} rounded-lg group-hover:scale-110 transition-transform`}><Icon size={12} /></div>
            </div>
            <p className={`text-lg font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ━━━ Platform Commission Breakdown ━━━ */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6">
        <h2 className="text-sm font-black text-gray-900 mb-5">Platform Commission Earned</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-purple-50 rounded-2xl p-5 text-center border border-purple-100">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">From COD Jobs ({derived.totalCodJobs})</p>
            <p className="text-2xl font-black text-purple-600">{fmtCurr(derived.totalCommissionFromCod)}</p>
            <p className="text-[10px] font-bold text-gray-400 mt-1">Commission + GST on COD bookings</p>
          </div>
          <div className="bg-blue-50 rounded-2xl p-5 text-center border border-blue-100">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">From Online Jobs ({derived.onlineJobs})</p>
            <p className="text-2xl font-black text-blue-600">{fmtCurr(derived.totalCommissionFromOnline)}</p>
            <p className="text-[10px] font-bold text-gray-400 mt-1">Commission + GST on online bookings</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-5 text-center border border-emerald-100">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Platform Revenue</p>
            <p className="text-2xl font-black text-emerald-600">{fmtCurr(derived.totalPlatformCommission)}</p>
            <p className="text-[10px] font-bold text-gray-400 mt-1">COD + Online commission combined</p>
          </div>
        </div>
      </div>

      {/* ━━━ Provider COD & Commission Table with Actions ━━━ */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><Building2 size={16} /></div>
            <h2 className="text-sm font-black text-gray-900">Provider COD & Collection Report</h2>
            <span className="text-[9px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg">{filteredProviders.length} providers</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search provider..."
                className="pl-9 pr-3 py-2 text-xs font-bold border border-gray-100 rounded-xl bg-gray-50 focus:outline-none focus:border-blue-300 w-44"
              />
            </div>
            <div className="flex border border-gray-100 rounded-xl overflow-hidden">
              {([
                { id: 'all', label: 'All', color: 'bg-gray-900' },
                { id: 'overdue', label: 'Overdue', color: 'bg-red-600' },
                { id: 'pending', label: 'Pending', color: 'bg-amber-600' },
                { id: 'settled', label: 'Settled', color: 'bg-emerald-600' },
              ] as const).map(tab => (
                <button key={tab.id} onClick={() => setFilterTab(tab.id)}
                  className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider ${filterTab === tab.id ? `${tab.color} text-white` : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                <th className="px-5 py-3">Provider</th>
                <th className="px-3 py-3 text-center">Jobs</th>
                <th className="px-3 py-3 text-center">Online</th>
                <th className="px-3 py-3 text-center">COD</th>
                <th className="px-3 py-3 text-right">COD Collected</th>
                <th className="px-3 py-3 text-right">Deposited</th>
                <th className="px-3 py-3 text-right">Outstanding</th>
                <th className="px-3 py-3 text-center">Due</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredProviders.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10 text-gray-400 font-bold text-xs">No providers found.</td></tr>
              ) : (
                filteredProviders.map((p, idx) => (
                  <tr key={idx} className="hover:bg-purple-50/10 transition-colors text-xs">
                    <td className="px-5 py-3 max-w-[160px]">
                      <p className="font-bold text-gray-900 truncate">{p.providerName}</p>
                      <p className="text-[9px] font-bold text-gray-400 mt-0.5">ID: {p.providerCode}</p>
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-gray-700">{p.totalJobs}</td>
                    <td className="px-3 py-3 text-center font-bold text-blue-600">{p.onlineJobs}</td>
                    <td className="px-3 py-3 text-center font-bold text-purple-600">{p.codJobs}</td>
                    <td className="px-3 py-3 text-right font-bold text-gray-900">{fmtCurr(p.codCollected)}</td>
                    <td className="px-3 py-3 text-right font-bold text-emerald-600">{fmtCurr(p.codDeposited)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`font-black ${p.codOutstanding > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                        {fmtCurr(p.codOutstanding)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-[10px] font-bold ${p.overdue ? 'text-red-600' : 'text-gray-500'}`}>
                        {p.dueDeadline}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {p.codOutstanding === 0 && p.codJobs > 0 ? (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-[9px] font-black">CLEAR</span>
                      ) : p.overdue ? (
                        <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[9px] font-black">OVERDUE</span>
                      ) : p.codOutstanding > 0 ? (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-lg text-[9px] font-black">PENDING</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedProvider(p)}
                          className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                          title="View Details"
                        >
                          <Eye size={12} />
                          View
                        </button>
                        {p.codOutstanding > 0 && (
                          <>
                            <button
                              onClick={() => handleSendReminder(p.providerId, p.providerName)}
                              disabled={actionLoadingId === p.providerId}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                              title="Send Reminder"
                            >
                              <Bell size={11} />
                              Notify
                            </button>
                            <button
                              onClick={() => openCashModal(p)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all shadow-2xs"
                              title="Record Hub Cash"
                            >
                              <DollarSign size={11} />
                              Record Cash
                            </button>
                          </>
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

      {/* ━━━ Individual COD Settlement Records ━━━ */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center gap-3">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Banknote size={16} /></div>
          <h2 className="text-sm font-black text-gray-900">Recent COD Settlements</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                <th className="px-5 py-3">Booking</th>
                <th className="px-5 py-3">Service Taken</th>
                <th className="px-5 py-3">Provider</th>
                <th className="px-5 py-3 text-right">Service Amount</th>
                <th className="px-5 py-3 text-right">Commission + GST</th>
                <th className="px-5 py-3 text-right">COD Due</th>
                <th className="px-5 py-3">Due Date</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredSettlements.filter(s => s.payment_type === 'cod').slice(0, 50).map((s, idx) => (
                <tr key={idx} className="hover:bg-blue-50/20 transition-colors text-xs">
                  <td className="px-5 py-3 font-black text-gray-900">
                    <p>{s.booking_display_id}</p>
                  </td>
                  <td className="px-5 py-3 max-w-[160px]">
                    <span className="inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-lg text-[10px] truncate max-w-full" title={s.service_name || s.variant_name || 'Home Service'}>
                      🛠️ {s.service_name || s.variant_name || 'Home Service'}
                    </span>
                  </td>
                  <td className="px-5 py-3 max-w-[140px]">
                    <p className="font-bold text-gray-600 truncate">{s.provider_id?.name || s.provider_id?.bankDetails?.accountHolderName || s.provider_id?.businessName || (s.provider_id?.provider_code ? `Provider ${s.provider_id.provider_code}` : 'Unknown Provider')}</p>
                    <p className="text-[9px] font-bold text-gray-400 mt-0.5">ID: {s.provider_id?.provider_code || String(s.provider_id?._id || s.provider_id || '').slice(-8).toUpperCase()}</p>
                  </td>
                  <td className="px-5 py-3 text-right font-black text-gray-900">₹{Number(s.gross_amount || 0).toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3 text-right font-black text-blue-600">
                    ₹{Number(((s.commission_amount || 0) + (s.gst_on_commission || 0)).toFixed(2)).toLocaleString("en-IN")}
                  </td>
                  <td className="px-5 py-3 text-right font-black text-purple-600">₹{Number(Number(s.cod_due_amount || 0).toFixed(2)).toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3 font-bold text-gray-500">
                    {s.cod_due_by ? new Date(s.cod_due_by).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                      s.status === 'cod_settled' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      s.status === 'cod_pending' && s.cod_due_by && new Date(s.cod_due_by) < new Date() ? 'bg-red-50 text-red-600 border-red-100' :
                      'bg-purple-50 text-purple-600 border-purple-100'
                    }`}>
                      {s.status === 'cod_settled' ? 'DEPOSITED' :
                       s.cod_due_by && new Date(s.cod_due_by) < new Date() ? 'OVERDUE' : 'PENDING'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ━━━ Provider Details Drawer ━━━ */}
      {selectedProvider && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <span className="text-[9px] font-black text-purple-600 uppercase tracking-widest">Provider COD Profile</span>
                <h2 className="text-xl font-black text-gray-900">{selectedProvider.providerName}</h2>
                <p className="text-xs text-gray-400 font-bold mt-0.5">ID: {selectedProvider.providerCode}</p>
              </div>
              <button onClick={() => setSelectedProvider(null)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            {/* Provider Finance 6-KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-gray-50 p-3 rounded-2xl text-center border border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Completed Jobs</p>
                <p className="text-lg font-black text-gray-900 mt-1">{selectedProvider.totalJobs}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-2xl text-center border border-blue-100">
                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Online Jobs</p>
                <p className="text-lg font-black text-blue-600 mt-1">{selectedProvider.onlineJobs}</p>
              </div>
              <div className="bg-purple-50 p-3 rounded-2xl text-center border border-purple-100">
                <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest">COD Jobs</p>
                <p className="text-lg font-black text-purple-600 mt-1">{selectedProvider.codJobs}</p>
              </div>
              <div className="bg-indigo-50 p-3 rounded-2xl text-center border border-indigo-100">
                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">COD Collected</p>
                <p className="text-lg font-black text-indigo-600 mt-1">{fmtCurr(selectedProvider.codCollected)}</p>
              </div>
              <div className="bg-emerald-50 p-3 rounded-2xl text-center border border-emerald-100">
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Already Deposited</p>
                <p className="text-lg font-black text-emerald-600 mt-1">{fmtCurr(selectedProvider.codDeposited)}</p>
              </div>
              <div className="bg-rose-50 p-3 rounded-2xl text-center border border-rose-100">
                <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Outstanding COD</p>
                <p className="text-lg font-black text-rose-600 mt-1">{fmtCurr(selectedProvider.codOutstanding)}</p>
              </div>
            </div>

            {/* Deposit Deadline */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-amber-900 uppercase tracking-wider">Deposit Deadline</p>
                <p className="text-sm font-bold text-amber-700 mt-0.5">{selectedProvider.dueDeadline}</p>
              </div>
              {selectedProvider.isBlocked ? (
                <span className="px-3 py-1 bg-red-600 text-white text-[10px] font-black uppercase rounded-lg">DISPATCH BLOCKED</span>
              ) : (
                <span className="px-3 py-1 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg">DISPATCH ACTIVE</span>
              )}
            </div>

            {/* Admin Actions */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">Admin Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSendReminder(selectedProvider.providerId, selectedProvider.providerName)}
                  disabled={actionLoadingId === selectedProvider.providerId}
                  className="p-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <Bell size={14} /> Send Reminder
                </button>
                <button
                  onClick={() => handleRequestDeposit(selectedProvider.providerId, selectedProvider.providerName)}
                  disabled={actionLoadingId === selectedProvider.providerId}
                  className="p-3 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <Send size={14} /> Request COD Deposit
                </button>
                <button
                  onClick={() => { setSelectedProvider(null); openCashModal(selectedProvider); }}
                  className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs col-span-2"
                >
                  <DollarSign size={14} /> Record Hub Cash Deposit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ Record Hub Cash Deposit Modal ━━━ */}
      {cashModalProvider && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><DollarSign size={18} /></div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Record Hub Cash Deposit</h3>
                  <p className="text-[10px] font-bold text-gray-400">{cashModalProvider.providerName} (ID: {cashModalProvider.providerCode})</p>
                </div>
              </div>
              <button onClick={() => setCashModalProvider(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleRecordCashSubmit} className="space-y-4">
              {cashModalError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-2xl flex items-center gap-2 animate-in fade-in duration-150">
                  <AlertTriangle size={16} className="shrink-0 text-red-600" />
                  <span>{cashModalError}</span>
                </div>
              )}

              <div className="p-3 bg-purple-50 border border-purple-100 rounded-2xl flex items-center justify-between">
                <span className="text-xs font-bold text-purple-700">Provider COD Liability</span>
                <span className="text-lg font-black text-purple-700">₹{cashModalProvider.codOutstanding.toLocaleString('en-IN')}</span>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Cash Received Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={cashForm.amount}
                  onChange={e => setCashForm({ ...cashForm, amount: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm font-black bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-600"
                  placeholder="Enter amount received"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Payment Method</label>
                <input type="text" readOnly value="Cash (Hub Collection)" className="w-full px-4 py-2 text-xs font-bold bg-gray-100 text-gray-600 rounded-xl cursor-not-allowed" />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Receipt / Ref Serial No.</label>
                <input
                  type="text"
                  required
                  value={cashForm.reference}
                  onChange={e => setCashForm({ ...cashForm, reference: e.target.value })}
                  className="w-full px-4 py-2 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Admin Remarks / Notes</label>
                <input
                  type="text"
                  value={cashForm.notes}
                  onChange={e => setCashForm({ ...cashForm, notes: e.target.value })}
                  className="w-full px-4 py-2 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setCashModalProvider(null)} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-800">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cashSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs flex items-center gap-2"
                >
                  <Check size={14} />
                  {cashSubmitting ? 'Saving...' : 'Save Cash Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ━━━ Generated Receipt Modal ━━━ */}
      {receiptData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-emerald-100">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <Receipt size={24} />
              </div>
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Official Receipt</span>
              <h3 className="text-2xl font-black text-gray-900">₹{receiptData.amountReceived?.toLocaleString('en-IN')}</h3>
              <p className="text-xs font-bold text-gray-500">{receiptData.receiptNo}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl space-y-2 text-xs font-bold text-gray-700 divide-y divide-gray-100">
              <div className="flex justify-between py-1"><span>Payment Method:</span><span>{receiptData.method}</span></div>
              <div className="flex justify-between py-1"><span>Reference ID:</span><span>{receiptData.reference}</span></div>
              <div className="flex justify-between py-1"><span>Previous Balance:</span><span>₹{receiptData.previousCodBalance?.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between py-1 text-emerald-600 font-black"><span>New Balance:</span><span>₹{receiptData.newCodBalance?.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between py-1"><span>Dispatch Status:</span><span className={receiptData.unblocked ? "text-emerald-600 font-black" : "text-amber-600"}>{receiptData.unblocked ? 'ACTIVE' : 'BLOCKED'}</span></div>
              <div className="flex justify-between py-1 text-[10px] text-gray-400"><span>Date:</span><span>{new Date(receiptData.date).toLocaleString('en-IN')}</span></div>
            </div>

            <button
              onClick={() => setReceiptData(null)}
              className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
            >
              Done & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
