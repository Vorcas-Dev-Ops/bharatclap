"use client";

import React, { useState, useEffect } from "react";
import AdminLayout from "../layout/AdminLayout";
import {
  Gift,
  Users,
  Award,
  Clock,
  ShieldAlert,
  Search,
  Filter,
  Download,
  CheckCircle2,
  XCircle,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { message, Modal } from "antd";
import { authFetch } from "@/utils/authFetch";
import { API_URL } from "@/config/api";

export default function AdminProviderReferralsPage() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>({});
  const [referralsData, setReferralsData] = useState<any>({ docs: [], page: 1, totalPages: 1, totalDocs: 0 });
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchAnalytics();
    fetchReferrals(1, statusFilter, searchTerm);
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await authFetch(`${API_URL}/providers/admin/referrals/analytics`);
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data || {});
      }
    } catch (err) {
      console.error("Failed to load analytics", err);
    }
  };

  const fetchReferrals = async (page: number, status: string, search: string) => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: "15",
        status: status !== "all" ? status : "",
        search,
      });

      const res = await authFetch(`${API_URL}/providers/admin/referrals/list?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReferralsData(data);
      }
    } catch (err) {
      console.error("Failed to fetch referrals list", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    fetchReferrals(1, newStatus, searchTerm);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReferrals(1, statusFilter, searchTerm);
  };

  const handleFraudDecision = async (referralId: string, action: "approve" | "reject") => {
    try {
      const res = await authFetch(`${API_URL}/providers/admin/referrals/${referralId}/fraud-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        message.success(`Fraud review ${action}d successfully`);
        fetchAnalytics();
        fetchReferrals(referralsData.page, statusFilter, searchTerm);
      } else {
        message.error("Failed processing decision");
      }
    } catch (err) {
      message.error("Error in fraud review decision");
    }
  };

  const handleExportCSV = () => {
    if (!referralsData.docs || referralsData.docs.length === 0) {
      message.warning("No records to export");
      return;
    }

    const headers = ["Referral ID", "Code", "Status", "Reward Amount", "Date Joined"];
    const rows = referralsData.docs.map((r: any) => [
      r._id,
      r.referralCode,
      r.status,
      `₹${r.rewardAmount}`,
      new Date(r.createdAt).toISOString(),
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e: any) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `provider_referrals_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs font-bold text-blue-700 mb-2">
              <Gift size={14} /> Provider Referral Center
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Provider Referrals & Audit
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Monitor invitations, pipeline conversion, fraud review flags, and ledger payouts.
            </p>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-sm"
          >
            <Download size={14} /> Export CSV Report
          </button>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Invitations</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{analytics.totalInvitations || 0}</h3>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">Conversion: {analytics.conversionRate || "0%"}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">KYC Pending</p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">{analytics.kycPending || 0}</h3>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">Awaiting document verification</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rewarded Referrals</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{analytics.rewarded || 0}</h3>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">Completed first service</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Rewards Paid</p>
            <h3 className="text-2xl font-black text-blue-600 mt-1">₹{analytics.totalRewardsPaid || 0}</h3>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">Wallet ledger credits</p>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
            {[
              { label: "All", value: "all" },
              { label: "Registered", value: "registered" },
              { label: "KYC Pending", value: "kyc_pending" },
              { label: "Waiting 1st Job", value: "waiting_first_job" },
              { label: "Rewarded", value: "rewarded" },
              { label: "Fraud Review", value: "fraud_review" },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleFilterChange(tab.value)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  statusFilter === tab.value
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search code (e.g. BCP-AB12CD)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition"
            >
              Search
            </button>
          </form>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">Loading referrals...</div>
          ) : referralsData.docs.length === 0 ? (
            <div className="p-12 text-center">
              <Users size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-700">No referral records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 text-xs uppercase font-bold tracking-wider">
                    <th className="py-3.5 px-6">Referral Code</th>
                    <th className="py-3.5 px-6">Joined Date</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6">Reward Amount</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {referralsData.docs.map((r: any) => (
                    <tr key={r._id} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6 font-mono font-bold text-slate-900">{r.referralCode}</td>
                      <td className="py-4 px-6 text-slate-500 text-xs">
                        {new Date(r.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            r.status === "rewarded"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : r.status === "fraud_review"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : r.status === "kyc_pending"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-bold text-emerald-600">₹{r.rewardAmount}</td>
                      <td className="py-4 px-6 text-right">
                        {r.status === "fraud_review" ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleFraudDecision(r._id, "approve")}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1"
                            >
                              <CheckCircle2 size={12} /> Clear Flag
                            </button>
                            <button
                              onClick={() => handleFraudDecision(r._id, "reject")}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1"
                            >
                              <XCircle size={12} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {referralsData.totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Page {referralsData.page} of {referralsData.totalPages} ({referralsData.totalDocs} records)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={!referralsData.hasPrevPage}
                  onClick={() => fetchReferrals(referralsData.page - 1, statusFilter, searchTerm)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 disabled:opacity-40 text-xs font-bold rounded-lg"
                >
                  Previous
                </button>
                <button
                  disabled={!referralsData.hasNextPage}
                  onClick={() => fetchReferrals(referralsData.page + 1, statusFilter, searchTerm)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 disabled:opacity-40 text-xs font-bold rounded-lg"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
