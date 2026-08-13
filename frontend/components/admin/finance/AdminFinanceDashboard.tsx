"use client";

import React, { useState, useEffect } from "react";
import { QrCode, Banknote, ShieldAlert, AlertTriangle, ArrowUpRight, RefreshCw, CheckCircle2, Search, Filter } from "lucide-react";
import axios from "axios";
import { API_URL } from "@/config/api";

interface AdminFinanceDashboardProps {
  token?: string;
}

export default function AdminFinanceDashboard({ token }: AdminFinanceDashboardProps) {
  const [metrics, setMetrics] = useState<any>({
    totalProviderCollections: 0,
    providerUpiCollections: 0,
    providerCashCollections: 0,
    cashFallbackPercent: 0,
    pendingConfirmationsCount: 0,
    cashPendingRemittance: 0
  });
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"METRICS" | "COLLECTIONS">("METRICS");
  const [searchTerm, setSearchTerm] = useState("");
  const [methodFilter, setMethodFilter] = useState("");

  const PAYMENT_API = process.env.NEXT_PUBLIC_PAYMENT_SERVICE_URL || "http://localhost:5005";

  const getAuthHeaders = () => {
    const authToken = token || (typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("adminToken") || localStorage.getItem("jwt") : null);
    if (authToken && authToken !== "null" && authToken !== "undefined") {
      return { Authorization: `Bearer ${authToken}` };
    }
    return {};
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();

      // Try API Gateway endpoint first, then direct payment service URL as fallback
      let metricsData = null;
      let collectionsData = null;

      try {
        const metricsRes = await axios.get(`${API_URL}/payments/admin/dashboard-metrics`, { headers });
        metricsData = metricsRes.data?.data?.metrics || metricsRes.data?.metrics;
      } catch (e) {
        try {
          const fallbackMetricsRes = await axios.get(`${PAYMENT_API}/api/payments/admin/dashboard-metrics`, { headers });
          metricsData = fallbackMetricsRes.data?.data?.metrics || fallbackMetricsRes.data?.metrics;
        } catch (err) {
          console.warn("Metrics fetch warning:", err);
        }
      }

      try {
        const collectionsRes = await axios.get(`${API_URL}/payments/admin/provider-collections?search=${searchTerm}&method=${methodFilter}`, { headers });
        collectionsData = collectionsRes.data?.data?.collections || collectionsRes.data?.collections;
      } catch (e) {
        try {
          const fallbackColRes = await axios.get(`${PAYMENT_API}/api/payments/admin/provider-collections?search=${searchTerm}&method=${methodFilter}`, { headers });
          collectionsData = fallbackColRes.data?.data?.collections || fallbackColRes.data?.collections;
        } catch (err) {
          console.warn("Collections fetch warning:", err);
        }
      }

      if (metricsData) {
        setMetrics(metricsData);
      }
      if (Array.isArray(collectionsData)) {
        setCollections(collectionsData);
      }
    } catch (err) {
      console.warn("Error loading finance dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [searchTerm, methodFilter, token]);

  return (
    // ponytail: Anti-blank Admin Finance Console with fallback metrics and token auto-auth
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Provider Collection & Cash Console</h2>
          <p className="text-[11px] font-bold text-gray-500 mt-0.5">
            Monitor Provider UPI collections, emergency cash fallback rates, UTR verification, and remittance status
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboardData}
            className="p-2 bg-white border border-gray-200 hover:border-gray-300 rounded-xl text-gray-600 shadow-2xs transition-all mr-1"
            title="Refresh Finance Metrics"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
          </button>
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => setActiveTab("METRICS")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "METRICS" ? "bg-white text-blue-600 shadow-2xs" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              Metrics Overview
            </button>
            <button
              onClick={() => setActiveTab("COLLECTIONS")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "COLLECTIONS" ? "bg-white text-blue-600 shadow-2xs" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              Collections Ledger
            </button>
          </div>
        </div>
      </div>

      {/* METRICS TILES */}
      {activeTab === "METRICS" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-2xs space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Total Provider Collections
            </span>
            <p className="text-2xl font-black text-gray-900">₹{(metrics.totalProviderCollections || 0).toLocaleString('en-IN')}</p>
            <div className="pt-2 border-t border-gray-50 flex justify-between text-[11px] font-bold text-gray-500">
              <span>UPI: ₹{(metrics.providerUpiCollections || 0).toLocaleString('en-IN')}</span>
              <span>Cash: ₹{(metrics.providerCashCollections || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="p-4 bg-white border border-amber-100 rounded-2xl shadow-2xs space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Cash Fallback Rate
            </span>
            <p className="text-2xl font-black text-amber-600">{metrics.cashFallbackPercent || 0}%</p>
            <p className="text-[10px] text-gray-400 font-bold">
              Target threshold: &lt; 15% platform-wide
            </p>
          </div>

          <div className="p-4 bg-white border border-blue-100 rounded-2xl shadow-2xs space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Pending Confirmations
            </span>
            <p className="text-2xl font-black text-blue-600">{metrics.pendingConfirmationsCount || 0}</p>
            <p className="text-[10px] text-blue-400 font-bold">
              Dual confirmation pending
            </p>
          </div>

          <div className="p-4 bg-white border border-rose-100 rounded-2xl shadow-2xs space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Cash Pending Remittance
            </span>
            <p className="text-2xl font-black text-rose-600">₹{(metrics.cashPendingRemittance || 0).toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-rose-400 font-bold">
              Unremitted provider cash
            </p>
          </div>
        </div>
      )}

      {/* COLLECTIONS LEDGER TABLE */}
      {activeTab === "COLLECTIONS" && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-2xs space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search UTR, Ref, or UPI handle..."
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-gray-200 text-xs font-bold text-gray-800 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="h-9 px-3 rounded-xl border border-gray-200 text-xs font-bold text-gray-800 bg-gray-50 outline-none"
              >
                <option value="">All Payment Methods</option>
                <option value="PROVIDER_UPI">Provider UPI</option>
                <option value="PROVIDER_CASH">Provider Cash</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase tracking-wider text-gray-400">
                  <th className="px-3 py-2.5">QR Reference</th>
                  <th className="px-3 py-2.5">Method</th>
                  <th className="px-3 py-2.5">Amount</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">UTR / Reference</th>
                  <th className="px-3 py-2.5">Cash Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-[11px]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400 font-bold">
                      <RefreshCw size={16} className="animate-spin inline-block mr-2" />
                      Loading collection metrics...
                    </td>
                  </tr>
                ) : collections.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400 font-bold">
                      No provider collections found.
                    </td>
                  </tr>
                ) : (
                  collections.map((col: any) => (
                    <tr key={col._id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="px-3 py-2.5 font-bold text-gray-900">{col.qr_reference}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          col.method === 'PROVIDER_UPI' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-amber-50 text-amber-800 border border-amber-100'
                        }`}>
                          {col.method}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-black text-gray-900">₹{col.amount_snapshot?.amount || col.amount || 0}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          col.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' :
                          col.status === 'CONFIRMED_BY_BOTH' || col.status === 'CASH_CONFIRMED' ? 'bg-blue-100 text-blue-700' :
                          col.status === 'DISPUTED' ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {col.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-gray-600">
                        {col.verified_transaction_reference || col.customer_transaction_reference || 'N/A'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500">{col.cash_reason || '-'}</td>
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

