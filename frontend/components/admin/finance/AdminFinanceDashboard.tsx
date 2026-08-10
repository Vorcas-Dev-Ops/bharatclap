"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  IndianRupee, ArrowUpRight, CheckCircle2, Clock, AlertTriangle, XCircle,
  Wallet, RefreshCcw, CreditCard, TrendingUp, FileText, ArrowRight, Banknote,
  ShieldCheck, Timer, BarChart3, Activity, Users, Building2, Eye, Bell,
  Download, ChevronDown, ChevronRight, X,
} from "lucide-react";
import axios from "axios";
import Link from "next/link";
import { API_URL } from "@/config/api";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from "recharts";

// ponytail: derive everything from the existing admin settlements API response
function deriveAdminAnalytics(settlements: any[], stats: any) {
  const now = new Date();

  // Platform revenue = total commission + GST collected
  const totalCommission = settlements.reduce((sum, s) => sum + (s.commission_amount || 0), 0);
  const totalGst = settlements.reduce((sum, s) => sum + (s.gst_on_commission || 0), 0);
  const platformRevenue = totalCommission + totalGst;

  // Status groups
  const byStatus: Record<string, any[]> = {};
  for (const s of settlements) {
    const st = s.status || "unknown";
    (byStatus[st] = byStatus[st] || []).push(s);
  }

  const sumField = (arr: any[], field: string) =>
    (arr || []).reduce((sum: number, s: any) => sum + (s[field] || 0), 0);

  const readyForPayout = sumField(byStatus["ready_for_payout"], "net_payable_amount");
  const totalPaid = sumField(byStatus["paid"], "net_payable_amount");
  const codOutstanding = sumField(byStatus["cod_pending"], "cod_due_amount");
  const failedCount = (byStatus["failed"] || []).length;

  // Pipeline counts
  const pipeline = [
    { label: "Pending", count: (byStatus["pending_hold"] || []).length, color: "bg-amber-50 text-amber-600 border-amber-100" },
    { label: "Ready", count: (byStatus["ready_for_payout"] || []).length, color: "bg-blue-50 text-blue-600 border-blue-100" },
    { label: "Processing", count: (byStatus["processing"] || []).length, color: "bg-indigo-50 text-indigo-600 border-indigo-100" },
    { label: "Paid", count: (byStatus["paid"] || []).length, color: "bg-emerald-50 text-emerald-600 border-emerald-100" },
    { label: "Hold", count: (byStatus["held_by_admin"] || []).length, color: "bg-rose-50 text-rose-600 border-rose-100" },
    { label: "Failed", count: (byStatus["failed"] || []).length, color: "bg-red-50 text-red-600 border-red-100" },
  ];

  // COD alerts — overdue providers
  const overdueMap = new Map<string, { providerId: string; providerName: string; outstanding: number; overdue: boolean }>();
  for (const s of (byStatus["cod_pending"] || [])) {
    const pid = String(s.provider_id?._id || s.provider_id);
    const provName = s.provider_id?.name || s.provider_id?.bankDetails?.accountHolderName || s.provider_id?.businessName || (s.provider_id?.provider_code ? `Provider ${s.provider_id.provider_code}` : `Provider ${pid.slice(-6)}`);
    const entry = overdueMap.get(pid) || { providerId: pid, providerName: provName, outstanding: 0, overdue: false };
    entry.outstanding += s.cod_due_amount || 0;
    if (s.cod_due_by && new Date(s.cod_due_by) < now) entry.overdue = true;
    overdueMap.set(pid, entry);
  }
  const codAlerts = Array.from(overdueMap.values()).filter(a => a.overdue || a.outstanding > 0).sort((a, b) => {
    if (a.overdue && !b.overdue) return -1;
    if (!a.overdue && b.overdue) return 1;
    return b.outstanding - a.outstanding;
  });

  // Recent activity — last 10 settlements with human-readable type
  const recentActivity = settlements.slice(0, 10).map((s: any) => {
    let action = "Settlement Created";
    let icon = "settlement";
    if (s.status === "paid") { action = "Payout Released"; icon = "payout"; }
    else if (s.status === "cod_settled") { action = "COD Remitted"; icon = "cod"; }
    else if (s.status === "ready_for_payout") { action = "Settlement Approved"; icon = "approved"; }
    else if (s.status === "held_by_admin") { action = "Settlement Held"; icon = "hold"; }
    else if (s.status === "failed") { action = "Payout Failed"; icon = "failed"; }

    return {
      action, icon,
      bookingId: s.booking_display_id || s.booking_id,
      amount: s.payment_type === "online" ? s.net_payable_amount : s.cod_due_amount,
      date: new Date(s.updatedAt || s.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
      status: s.status,
    };
  });

  // Finance health
  const totalSettlements = settlements.length;
  const successCount = (byStatus["paid"] || []).length + (byStatus["cod_settled"] || []).length;
  const settlementSuccessRate = totalSettlements > 0 ? Math.round((successCount / totalSettlements) * 100) : 100;

  const codTotal = (byStatus["cod_pending"] || []).length + (byStatus["cod_settled"] || []).length;
  const codSettled = (byStatus["cod_settled"] || []).length;
  const codCollectionRate = codTotal > 0 ? Math.round((codSettled / codTotal) * 100) : 100;

  const paidWithTimes = (byStatus["paid"] || []).filter((s: any) => s.paid_at && s.createdAt);
  const avgPayoutDays = paidWithTimes.length > 0
    ? (paidWithTimes.reduce((sum: number, s: any) =>
        sum + (new Date(s.paid_at).getTime() - new Date(s.createdAt).getTime()), 0
      ) / paidWithTimes.length / (1000 * 60 * 60 * 24)).toFixed(1)
    : "—";

  // 30-day settlement volume trend
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dailyMap = new Map<string, { count: number; amount: number }>();
  for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
    dailyMap.set(d.toISOString().split("T")[0], { count: 0, amount: 0 });
  }
  for (const s of settlements) {
    const day = new Date(s.createdAt).toISOString().split("T")[0];
    if (dailyMap.has(day)) {
      const e = dailyMap.get(day)!;
      e.count += 1;
      e.amount += s.gross_amount || 0;
    }
  }
  const trendData = Array.from(dailyMap.entries()).map(([date, vals]) => ({
    date: new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    settlements: vals.count,
    volume: Math.round(vals.amount),
  }));

  // Status pie
  const STATUS_COLORS: Record<string, string> = {
    pending_hold: "#F59E0B", ready_for_payout: "#3B82F6", paid: "#10B981",
    cod_pending: "#8B5CF6", cod_settled: "#06B6D4", held_by_admin: "#EF4444",
    failed: "#DC2626", processing: "#6366F1",
  };
  const statusPieData = Object.entries(byStatus).map(([status, arr]) => ({
    name: status.replace(/_/g, " "),
    value: arr.length,
    color: STATUS_COLORS[status] || "#94A3B8",
  }));

  // COD Ageing chart data
  const codAgeingData = stats?.codAgeing ? [
    { label: "0-2 Days", amount: stats.codAgeing['0-2d'] || 0, fill: "#10B981" },
    { label: "3-5 Days", amount: stats.codAgeing['3-5d'] || 0, fill: "#F59E0B" },
    { label: "6-10 Days", amount: stats.codAgeing['6-10d'] || 0, fill: "#EF4444" },
    { label: "10+ Days", amount: stats.codAgeing['10d+'] || 0, fill: "#DC2626" },
  ] : [];

  return {
    platformRevenue, readyForPayout, totalPaid, codOutstanding, failedCount,
    pipeline, codAlerts, recentActivity,
    settlementSuccessRate, codCollectionRate, avgPayoutDays,
    trendData, statusPieData, codAgeingData,
  };
}

const ACTIVITY_ICONS: Record<string, { icon: any; color: string }> = {
  settlement: { icon: FileText, color: "bg-blue-50 text-blue-600" },
  payout: { icon: CheckCircle2, color: "bg-emerald-50 text-emerald-600" },
  cod: { icon: Banknote, color: "bg-purple-50 text-purple-600" },
  approved: { icon: ArrowUpRight, color: "bg-sky-50 text-sky-600" },
  hold: { icon: AlertTriangle, color: "bg-amber-50 text-amber-600" },
  failed: { icon: XCircle, color: "bg-red-50 text-red-600" },
};

export default function AdminFinanceDashboard() {
  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [providerFinanceTable, setProviderFinanceTable] = useState<any[]>([]);
  const [selectedSettlement, setSelectedSettlement] = useState<any>(null);
  const [providerTab, setProviderTab] = useState<'all' | 'cod_due'>('all');

  useEffect(() => {
    fetchData();
  }, []);

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
        setProviderFinanceTable(Array.isArray(res.data.providerFinanceTable) ? res.data.providerFinanceTable : []);
      }
    } catch (err: any) {
      console.warn("Error fetching finance data:", err?.message);
    } finally {
      setLoading(false);
    }
  };

  const derived = useMemo(() => {
    if (settlements.length === 0 && !loading) return deriveAdminAnalytics([], stats);
    return deriveAdminAnalytics(settlements, stats);
  }, [settlements, loading, stats]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600 mb-4" />
        <p className="text-gray-400 font-bold text-sm">Loading Finance Dashboard...</p>
      </div>
    );
  }

  const formatLakhs = (val: number) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val.toLocaleString("en-IN")}`;
  };

  const filteredProviders = providerTab === 'cod_due'
    ? providerFinanceTable.filter(p => p.outstandingCod > 0)
    : providerFinanceTable;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            Finance <span className="text-blue-600">Operations Center</span>
          </h1>
          <p className="text-xs font-bold text-gray-500 mt-1">
            Platform revenue, settlement pipeline, COD management, and provider finance at a glance
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-3 bg-white border border-gray-100 hover:border-gray-200 rounded-2xl text-gray-600 shadow-xs transition-all"
          title="Refresh"
        >
          <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ━━━ Section 1: Top KPI Cards ━━━ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        {[
          { label: "Today's Revenue", value: formatLakhs(stats.todayRevenue || 0), icon: IndianRupee, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
          { label: "Online Revenue", value: formatLakhs(stats.todayOnlineRevenue || 0), icon: CreditCard, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
          { label: "COD Revenue", value: formatLakhs(stats.todayCodRevenue || 0), icon: Banknote, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
          { label: "Platform Commission", value: formatLakhs(derived.platformRevenue), icon: TrendingUp, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
          { label: "Pending Settlements", value: String((stats.totalPendingHold || 0) > 0 ? formatLakhs(stats.totalPendingHold) : "₹0"), icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
          { label: "Ready for Payout", value: formatLakhs(derived.readyForPayout), icon: ArrowUpRight, color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-100" },
          { label: "Outstanding COD", value: formatLakhs(derived.codOutstanding), icon: Wallet, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" },
          { label: "COD Providers", value: String(stats.providersWithPendingCod || 0), icon: Users, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100" },
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

      {/* ━━━ Section 2: Settlement Pipeline ━━━ */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6">
        <h2 className="text-sm font-black text-gray-900 mb-5">Settlement Pipeline</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {derived.pipeline.map((stage) => (
            <div key={stage.label} className={`rounded-2xl border p-4 text-center ${stage.color}`}>
              <p className="text-2xl font-black">{stage.count}</p>
              <p className="text-[9px] font-black uppercase tracking-widest mt-1">{stage.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ━━━ 2-Column Layout: Charts + Finance Health + COD Ageing ━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Settlement Volume Trend */}
          {derived.trendData.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6">
              <h2 className="text-sm font-black text-gray-900 mb-5">30-Day Settlement Volume</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={derived.trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#94a3b8" }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 16, border: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700 }}
                      formatter={(value: any, name: any) => [
                        name === "volume" ? `₹${Number(value).toLocaleString("en-IN")}` : value,
                        name === "volume" ? "Volume" : "Settlements",
                      ]}
                    />
                    <Area type="monotone" dataKey="volume" stroke="#6366F1" strokeWidth={2} fill="url(#volGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* COD Ageing Chart */}
          {derived.codAgeingData.some(d => d.amount > 0) && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Timer size={16} /></div>
                <h2 className="text-sm font-black text-gray-900">COD Ageing Analysis</h2>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={derived.codAgeingData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700 }}
                      formatter={(v: any) => [`₹${Number(v).toLocaleString("en-IN")}`, "Amount"]} />
                    <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                      {derived.codAgeingData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Status Distribution Pie */}
          {derived.statusPieData.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6">
              <h2 className="text-sm font-black text-gray-900 mb-4">Settlement Distribution</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={derived.statusPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                      {derived.statusPieData.map((entry: any, idx: number) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700 }} />
                    <Legend verticalAlign="bottom" iconType="circle" iconSize={8}
                      formatter={(value) => <span style={{ fontSize: 9, fontWeight: 800, color: "#475569", textTransform: "capitalize" }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Finance Health */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6 space-y-5">
            <h2 className="text-sm font-black text-gray-900">Finance Health</h2>
            {[
              { label: "Settlement Success Rate", value: derived.settlementSuccessRate, color: "bg-emerald-500" },
              { label: "COD Collection Rate", value: derived.codCollectionRate, color: "bg-purple-500" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">{label}</span>
                  <span className="text-xs font-black text-gray-900">{value}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2 border-t border-gray-50">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Avg Payout Time</span>
              <span className="text-lg font-black text-gray-900">{derived.avgPayoutDays} <span className="text-[10px] text-gray-400">Days</span></span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-50">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Today&apos;s Jobs</span>
              <span className="text-lg font-black text-gray-900">{stats.todayJobs || 0}</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6 space-y-3">
            <h2 className="text-sm font-black text-gray-900 mb-2">Quick Actions</h2>
            {[
              { label: "View Settlements", href: "/admin/settlements", icon: FileText },
              { label: "View Payouts", href: "/admin/payouts", icon: Banknote },
              { label: "Refunds", href: "/admin/refunds", icon: ArrowUpRight },
              { label: "Commissions", href: "/admin/commissions", icon: CreditCard },
              { label: "Wallet Adjustments", href: "/admin/wallet-center", icon: Wallet },
            ].map(({ label, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-50 text-gray-500 rounded-xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                    <Icon size={14} />
                  </div>
                  <span className="text-xs font-bold text-gray-700 group-hover:text-gray-900">{label}</span>
                </div>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-blue-600 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ━━━ Section: Provider Finance Table ━━━ */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Building2 size={16} /></div>
            <h2 className="text-sm font-black text-gray-900">Provider Finance Summary</h2>
            <span className="text-[9px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg">{filteredProviders.length} providers</span>
          </div>
          <div className="flex border border-gray-100 rounded-xl overflow-hidden">
            <button onClick={() => setProviderTab('all')}
              className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider ${providerTab === 'all' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              All
            </button>
            <button onClick={() => setProviderTab('cod_due')}
              className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider ${providerTab === 'cod_due' ? 'bg-rose-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              COD Due
            </button>
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
                <th className="px-3 py-3 text-right">Earnings</th>
                <th className="px-3 py-3 text-right">COD Collected</th>
                <th className="px-3 py-3 text-right">COD Deposited</th>
                <th className="px-3 py-3 text-right">Outstanding</th>
                <th className="px-3 py-3 text-center">Pending</th>
                <th className="px-3 py-3 text-right">Wallet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredProviders.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10 text-gray-400 font-bold text-xs">No providers found.</td></tr>
              ) : (
                filteredProviders.slice(0, 50).map((p: any, idx: number) => (
                  <tr key={idx} className="hover:bg-blue-50/20 transition-colors text-xs">
                    <td className="px-5 py-3 font-bold text-gray-800 max-w-[140px] truncate">{p.providerName}</td>
                    <td className="px-3 py-3 text-center font-bold text-gray-700">{p.completedJobs}</td>
                    <td className="px-3 py-3 text-center font-bold text-blue-600">{p.onlineJobs}</td>
                    <td className="px-3 py-3 text-center font-bold text-purple-600">{p.codJobs}</td>
                    <td className="px-3 py-3 text-right font-bold text-gray-900">₹{p.totalEarnings.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-3 text-right font-bold text-gray-600">₹{p.codCollected.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-3 text-right font-bold text-emerald-600">₹{p.codDeposited.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`font-black ${p.outstandingCod > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                        ₹{p.outstandingCod.toLocaleString("en-IN")}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {p.pendingSettlements > 0 ? (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-lg text-[9px] font-black">{p.pendingSettlements}</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-gray-700">₹{p.walletBalance.toLocaleString("en-IN")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ━━━ Section: COD Alerts ━━━ */}
      {derived.codAlerts.length > 0 && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex items-center gap-3">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><AlertTriangle size={16} /></div>
            <h2 className="text-sm font-black text-gray-900">COD Alerts — Providers with Outstanding Dues</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <th className="px-6 py-3">Provider</th>
                  <th className="px-6 py-3">Outstanding</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {derived.codAlerts.slice(0, 10).map((alert, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-xs font-bold text-gray-800">{alert.providerName}</td>
                    <td className="px-6 py-4 text-xs font-black text-gray-900">₹{alert.outstanding.toLocaleString("en-IN")}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider ${
                        alert.overdue ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {alert.overdue ? "Overdue" : "Pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ━━━ Section: Recent Finance Activity ━━━ */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6">
        <h2 className="text-sm font-black text-gray-900 mb-5">Recent Finance Activity</h2>
        <div className="space-y-1">
          {derived.recentActivity.length === 0 ? (
            <p className="text-center text-gray-400 font-bold text-xs py-8">No recent activity.</p>
          ) : (
            derived.recentActivity.map((item: any, idx: number) => {
              const config = ACTIVITY_ICONS[item.icon] || ACTIVITY_ICONS.settlement;
              const IconComp = config.icon;
              return (
                <div key={idx} className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0">
                  <div className={`p-2 rounded-xl shrink-0 ${config.color}`}>
                    <IconComp size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800">{item.action}</p>
                    <p className="text-[10px] font-bold text-gray-400">{item.bookingId}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-gray-900">{item.amount ? `₹${item.amount.toLocaleString("en-IN")}` : "—"}</p>
                    <p className="text-[9px] font-bold text-gray-400">{item.date}</p>
                  </div>
                </div>
              );
            })
          )}
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
            <div className="space-y-2 mb-6">
              <p className="text-xs font-bold text-gray-500">Booking: <span className="text-gray-900">{selectedSettlement.booking_display_id}</span></p>
              <p className="text-xs font-bold text-gray-500">Amount: <span className="text-gray-900">₹{selectedSettlement.gross_amount?.toLocaleString("en-IN")}</span></p>
              <p className="text-xs font-bold text-gray-500">Status: <span className="text-gray-900 uppercase">{selectedSettlement.status?.replace(/_/g, ' ')}</span></p>
            </div>
            <div className="relative pl-6 border-l-2 border-gray-200 space-y-6">
              {(selectedSettlement.audit_trail || []).map((entry: any, idx: number) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[25px] w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
                  <p className="text-xs font-black text-gray-900">{entry.action?.replace(/_/g, ' ')}</p>
                  <p className="text-[10px] font-bold text-gray-400">{entry.notes}</p>
                  <p className="text-[9px] font-bold text-gray-300 mt-0.5">
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleString("en-IN") : '—'}
                    {entry.performed_by && entry.performed_by !== 'system' ? ` • by ${entry.performed_by}` : ''}
                  </p>
                </div>
              ))}
              {(!selectedSettlement.audit_trail || selectedSettlement.audit_trail.length === 0) && (
                <p className="text-xs text-gray-400 font-bold">No audit trail recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
