"use client";

import React, { useEffect, useState } from "react";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import axios from "axios";
import {
  Search, CreditCard, RefreshCw, AlertCircle,
  CheckCircle, XCircle, Clock, ReceiptText
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";

// ─── Types ────────────────────────────────────────────────────────────────────
type ViewMode = "history" | "refund";

interface Payment {
  _id: string;
  booking_id: string;
  subservice_name: string;
  amount: number;
  payment_method: string;
  payment_status: "pending" | "completed" | "failed" | "refunded";
  transaction_id: string;
  payment_date: string;
}

// ─── Status chip config ───────────────────────────────────────────────────────
const statusCfg: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  completed: { label: "Paid", cls: "bg-emerald-100 text-emerald-700 border border-emerald-200", icon: CheckCircle },
  refunded: { label: "Refunded", cls: "bg-blue-100 text-blue-700 border border-blue-200", icon: RefreshCw },
  failed: { label: "Failed", cls: "bg-red-100 text-red-700 border border-red-200", icon: XCircle },
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-700 border border-amber-200", icon: Clock },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtINR = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// ─── Main Component ───────────────────────────────────────────────────────────
const BillingPage = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("history");

  // Fetch on mount
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        const { data } = await axios.get(`${API_URL}/payments/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPayments(data);
      } catch (e: any) {
        setError(e?.response?.data?.message || "Failed to load payments.");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  // Derived data
  const totalPaid = payments.filter(p => p.payment_status === "completed").reduce((s, p) => s + p.amount, 0);
  const totalRefunded = payments.filter(p => p.payment_status === "refunded").reduce((s, p) => s + p.amount, 0);
  const totalTxns = payments.length;

  const filtered = payments.filter(p => {
    const matchView =
      view === "history"
        ? true                              // all records
        : p.payment_status === "refunded";  // only refunded

    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.booking_id.toLowerCase().includes(q) ||
      p.subservice_name.toLowerCase().includes(q) ||
      p.transaction_id.toLowerCase().includes(q) ||
      p.payment_method.toLowerCase().includes(q);

    return matchView && matchSearch;
  });

  // ─── Skeleton ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="h-8 w-40 bg-slate-200 rounded-xl animate-pulse mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm h-64 animate-pulse" />
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm h-64 animate-pulse" />
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  // ─── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <main className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-10 flex flex-col items-center gap-3 pt-32 text-center">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <p className="text-slate-600 font-bold">{error}</p>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-1 py-6 space-y-10">

        {/* ── Row 1: Centered Heading ────────────────────────────────── */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Payments</h1>
          <div className="w-12 h-1.5 bg-[#1D2B83] mx-auto rounded-full opacity-20" />
        </div>

        {/* ── Row 2: Search on Left, Toggle in Middle ───────────────── */}
        <div className="relative flex flex-col md:flex-row items-center justify-center gap-6">
          {/* Left: Search (absolute on md+) */}
          <div className="w-full md:w-auto md:absolute md:left-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search history..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#1D2B83] transition-all w-full md:w-64 shadow-sm"
              />
            </div>
          </div>

          {/* Middle: Toggle */}
          <div className="flex rounded-2xl border-2 border-slate-200 bg-white shadow-sm p-1 overflow-hidden z-10">
            {([{ key: "history", label: "Total History" }, { key: "refund", label: "Refunds" }] as const).map(v => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${view === v.key
                    ? "bg-[#1D2B83] text-white shadow-lg shadow-blue-900/20"
                    : "text-slate-500 hover:bg-slate-50"
                  }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Row 3: Three Summary Cards ─────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: "Total Transactions", value: totalTxns, icon: ReceiptText, color: "text-slate-700", bg: "bg-white" },
            { label: "Total Amount Paid", value: fmtINR(totalPaid), icon: CreditCard, color: "text-emerald-600", bg: "bg-emerald-50/30" },
            { label: "Total Refunded", value: fmtINR(totalRefunded), icon: RefreshCw, color: "text-blue-600", bg: "bg-blue-50/30" }
          ].map((card, i) => (
            <div key={i} className={`${card.bg} p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5 transition-transform hover:scale-[1.02] duration-300`}>
              <div className={`w-14 h-14 rounded-2xl ${card.bg === 'bg-white' ? 'bg-slate-50' : 'bg-white'} shadow-sm flex items-center justify-center`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
                <p className={`text-2xl font-black ${card.color} tracking-tight`}>{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Row 4: Table + Status Breakdown ───────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* Main Table area */}
          <div className="flex-1 w-full bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                {view === "history" ? "Transaction History" : "Refund Records"}
              </h2>
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[11px] font-black uppercase tracking-wider">
                {filtered.length} Entries
              </span>
            </div>

            {filtered.length === 0 ? (
              <div className="py-24 flex flex-col items-center gap-4 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                  <ReceiptText className="w-10 h-10 text-slate-200" />
                </div>
                <p className="text-slate-400 font-bold">
                  {view === "refund" ? "No refunded transactions yet" : "No payment history found"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      {["Booking ID", "Service", "Amount", "Status", "Transaction ID", "Date"].map(h => (
                        <th key={h} className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map(p => {
                      const s = statusCfg[p.payment_status] ?? statusCfg.pending;
                      const Icon = s.icon;
                      return (
                        <tr key={p._id} className="hover:bg-slate-50/40 transition-colors group">
                          <td className="px-6 py-5">
                            <span className="font-black text-[#1D2B83] text-xs bg-blue-50 px-2.5 py-1.5 rounded-xl">
                              {p.booking_id}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <p className="font-bold text-slate-800">{p.subservice_name}</p>
                          </td>
                          <td className="px-6 py-5">
                            <span className={`text-base font-black ${p.payment_status === "refunded" ? "text-blue-600" : "text-slate-900"}`}>
                              {fmtINR(p.amount)}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full ${s.cls}`}>
                              <Icon className="w-3.5 h-3.5" /> {s.label}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                              {p.transaction_id}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <span className="text-slate-500 font-bold text-xs">{fmt(p.payment_date)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Status Breakdown card */}
          <div className="w-full lg:w-80 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex-shrink-0">
            <div className="px-8 py-6 border-b border-slate-50">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">By Status</h2>
            </div>
            <div className="p-8 space-y-6">
              {(["completed", "refunded", "failed", "pending"] as const).map(st => {
                const count = payments.filter(p => p.payment_status === st).length;
                const cfg = statusCfg[st];
                const Icon = cfg.icon;
                return (
                  <div key={st} className="flex items-center justify-between group cursor-default">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${cfg.cls.split(' ')[0]} border-none shadow-sm group-hover:scale-110`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-black text-slate-600">{cfg.label}</span>
                    </div>
                    <span className="text-base font-black text-slate-900">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      <Footer />
    </main>
  );
};

export default BillingPage;
