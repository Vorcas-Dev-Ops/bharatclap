"use client";

import React, { useState, useEffect } from "react";
import { QrCode, Banknote, ShieldAlert, AlertTriangle, ArrowUpRight, RefreshCw, CheckCircle2, Search, Filter } from "lucide-react";
import axios from "axios";

interface AdminFinanceDashboardProps {
  token?: string;
}

export default function AdminFinanceDashboard({ token }: AdminFinanceDashboardProps) {
  const [metrics, setMetrics] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"METRICS" | "COLLECTIONS" | "DISPUTES">("METRICS");
  const [searchTerm, setSearchTerm] = useState("");
  const [methodFilter, setMethodFilter] = useState("");

  const PAYMENT_API = process.env.NEXT_PUBLIC_PAYMENT_SERVICE_URL || "http://localhost:5005";

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [metricsRes, collectionsRes] = await Promise.all([
        axios.get(`${PAYMENT_API}/api/payments/admin/dashboard-metrics`, { headers }),
        axios.get(`${PAYMENT_API}/api/payments/admin/provider-collections?search=${searchTerm}&method=${methodFilter}`, { headers }),
      ]);

      if (metricsRes.data?.data?.metrics) {
        setMetrics(metricsRes.data.data.metrics);
      }

      if (collectionsRes.data?.data?.collections) {
        setCollections(collectionsRes.data.data.collections);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [searchTerm, methodFilter, token]);

  return (
    <div className="space-y-8">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-black text-slate-800">Provider Collection & Cash Finance Console</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">
            Monitor Provider UPI collections, emergency cash fallback rates, UTR verification, and disputes
          </p>
        </div>

        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl">
          <button
            onClick={() => setActiveTab("METRICS")}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === "METRICS" ? "bg-white text-[#1D2B83] shadow-md" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Metrics Overview
          </button>
          <button
            onClick={() => setActiveTab("COLLECTIONS")}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === "COLLECTIONS" ? "bg-white text-[#1D2B83] shadow-md" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Collections Ledger
          </button>
        </div>
      </div>

      {/* METRICS TILES */}
      {activeTab === "METRICS" && metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Total Provider Collections
            </span>
            <p className="text-2xl font-black text-slate-800">₹{metrics.totalProviderCollections}</p>
            <div className="pt-2 border-t border-slate-100 flex justify-between text-xs font-bold text-slate-500">
              <span>UPI: ₹{metrics.providerUpiCollections}</span>
              <span>Cash: ₹{metrics.providerCashCollections}</span>
            </div>
          </div>

          <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Cash Fallback Rate
            </span>
            <p className="text-2xl font-black text-amber-600">{metrics.cashFallbackPercent}%</p>
            <p className="text-xs text-slate-400 font-medium">
              Target threshold: &lt; 15% platform-wide
            </p>
          </div>

          <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Pending Confirmations
            </span>
            <p className="text-2xl font-black text-slate-800">{metrics.pendingConfirmationsCount}</p>
            <p className="text-xs text-slate-400 font-medium">
              Dual confirmation pending
            </p>
          </div>

          <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Cash Pending Remittance
            </span>
            <p className="text-2xl font-black text-rose-600">₹{metrics.cashPendingRemittance}</p>
            <p className="text-xs text-slate-400 font-medium">
              Unremitted provider cash
            </p>
          </div>
        </div>
      )}

      {/* COLLECTIONS LEDGER TABLE */}
      {activeTab === "COLLECTIONS" && (
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-5">
          {/* Filters */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search UTR, Ref, or UPI handle..."
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:border-[#1D2B83] outline-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="h-11 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 outline-none"
              >
                <option value="">All Payment Methods</option>
                <option value="PROVIDER_UPI">Provider UPI</option>
                <option value="PROVIDER_CASH">Provider Cash</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="pb-3">QR Reference</th>
                  <th className="pb-3">Method</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">UTR / Reference</th>
                  <th className="pb-3">Cash Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {collections.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                      No provider collections found.
                    </td>
                  </tr>
                ) : (
                  collections.map((col: any) => (
                    <tr key={col._id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 font-bold text-slate-800">{col.qr_reference}</td>
                      <td className="py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          col.method === 'PROVIDER_UPI' ? 'bg-indigo-50 text-[#1D2B83]' : 'bg-amber-50 text-amber-800'
                        }`}>
                          {col.method}
                        </span>
                      </td>
                      <td className="py-3.5 font-black text-slate-800">₹{col.amount_snapshot?.amount}</td>
                      <td className="py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          col.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700' :
                          col.status === 'CONFIRMED_BY_BOTH' || col.status === 'CASH_CONFIRMED' ? 'bg-blue-50 text-blue-700' :
                          col.status === 'DISPUTED' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {col.status}
                        </span>
                      </td>
                      <td className="py-3.5 font-mono text-[11px] text-slate-600">
                        {col.verified_transaction_reference || col.customer_transaction_reference || 'N/A'}
                      </td>
                      <td className="py-3.5 text-slate-500">{col.cash_reason || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
