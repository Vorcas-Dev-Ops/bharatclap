"use client";

import React, { useState, useEffect } from "react";
import { Trash2, ShieldCheck, AlertTriangle, Search, Filter, RefreshCw, Eye, CheckCircle2 } from "lucide-react";
import axios from "axios";

interface AdminDeletionRequestsTableProps {
  token?: string;
}

export default function AdminDeletionRequestsTable({ token }: AdminDeletionRequestsTableProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  const AUTH_API = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || "http://localhost:5001";

  const fetchDeletionRequests = async () => {
    try {
      setLoading(true);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await axios.get(
        `${AUTH_API}/api/users/admin/deletion-requests?status=${statusFilter}&account_type=${accountTypeFilter}`,
        { headers }
      );

      if (res.data?.data?.records) {
        setRecords(res.data.data.records);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletionRequests();
  }, [statusFilter, accountTypeFilter, token]);

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-600" /> Account Deletion Compliance Console
          </h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">
            Audit Google Play deletion requests, obligations, data retention, and outbox worker status
          </p>
        </div>

        <button
          onClick={fetchDeletionRequests}
          disabled={loading}
          className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 outline-none"
          >
            <option value="">All Statuses</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="PARTIALLY_RETAINED">PARTIALLY_RETAINED</option>
            <option value="DELETED">DELETED</option>
            <option value="BLOCKED_PENDING_OBLIGATION">BLOCKED_PENDING_OBLIGATION</option>
            <option value="FAILED_NEEDS_REVIEW">FAILED_NEEDS_REVIEW (Needs Attention)</option>
          </select>

          <select
            value={accountTypeFilter}
            onChange={(e) => setAccountTypeFilter(e.target.value)}
            className="h-11 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 outline-none"
          >
            <option value="">All Account Types</option>
            <option value="CUSTOMER">CUSTOMER</option>
            <option value="PROVIDER">PROVIDER</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-medium border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <th className="pb-3">Request ID</th>
              <th className="pb-3">Account Type</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Requested At</th>
              <th className="pb-3">Obligations</th>
              <th className="pb-3">Razorpay Status</th>
              <th className="pb-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400 font-bold">
                  No deletion requests found.
                </td>
              </tr>
            ) : (
              records.map((r: any) => (
                <tr key={r._id} className="hover:bg-slate-50/80">
                  <td className="py-3.5 font-mono font-bold text-slate-800">{r.request_id}</td>
                  <td className="py-3.5 font-bold uppercase text-slate-700">{r.account_type}</td>
                  <td className="py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      r.status === 'DELETED' || r.status === 'PARTIALLY_RETAINED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : r.status === 'FAILED_NEEDS_REVIEW'
                        ? 'bg-rose-100 text-rose-800 font-black animate-pulse'
                        : r.status === 'BLOCKED_PENDING_OBLIGATION'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3.5 text-slate-500">{new Date(r.requested_at).toLocaleString()}</td>
                  <td className="py-3.5 text-slate-600">
                    {r.blocking_obligations && r.blocking_obligations.length > 0 ? (
                      <span className="text-amber-700 font-bold">{r.blocking_obligations.length} Active</span>
                    ) : (
                      <span className="text-emerald-700 font-bold">Clear</span>
                    )}
                  </td>
                  <td className="py-3.5 font-mono text-[11px] text-slate-500">
                    {r.razorpay_request_status || 'NOT_APPLICABLE'}
                  </td>
                  <td className="py-3.5">
                    <button
                      onClick={() => setSelectedRequest(r)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Audit Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-black text-slate-800">
                Audit Detail: <span className="font-mono text-[#1D2B83]">{selectedRequest.request_id}</span>
              </h4>
              <button onClick={() => setSelectedRequest(null)} className="p-1 rounded-full hover:bg-slate-100">
                <Trash2 className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-medium">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block font-bold uppercase text-[10px]">Account Type</span>
                <span className="font-bold text-slate-800 uppercase">{selectedRequest.account_type}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block font-bold uppercase text-[10px]">Retention Status</span>
                <span className="font-bold text-slate-800">{selectedRequest.retention_status || 'NONE'}</span>
              </div>
            </div>

            {selectedRequest.retained_data_summary && selectedRequest.retained_data_summary.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs space-y-1">
                <strong className="text-blue-900 block font-bold">Retained Data Summary (Legally Mandated):</strong>
                {selectedRequest.retained_data_summary.map((item: string, idx: number) => (
                  <p key={idx} className="text-blue-800">• {item}</p>
                ))}
              </div>
            )}

            {/* Provider Financial Snapshot & Explicit Actions */}
            {selectedRequest.account_type === 'PROVIDER' && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Provider Financial Snapshot
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2 bg-white rounded-lg border border-slate-100">
                    <span className="text-slate-400 text-[10px] block font-bold">Earnings Owed</span>
                    <span className="font-bold text-slate-800">₹{((selectedRequest.financial_snapshot?.earnings_owed_paise || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-100">
                    <span className="text-slate-400 text-[10px] block font-bold">Pending Settlement</span>
                    <span className="font-bold text-amber-600">₹{((selectedRequest.financial_snapshot?.pending_settlement_paise || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-100">
                    <span className="text-slate-400 text-[10px] block font-bold">Purchased Wallet</span>
                    <span className="font-bold text-slate-800">₹{((selectedRequest.financial_snapshot?.purchased_wallet_paise || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-100">
                    <span className="text-slate-400 text-[10px] block font-bold">Promotional Credit</span>
                    <span className="font-bold text-slate-800">₹{((selectedRequest.financial_snapshot?.promotional_credit_paise || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-100">
                    <span className="text-slate-400 text-[10px] block font-bold">Active Subscription</span>
                    <span className="font-bold text-rose-600">NON-REFUNDABLE</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-100">
                    <span className="text-slate-400 text-[10px] block font-bold">Lead Package</span>
                    <span className="font-bold text-rose-600">NON-REFUNDABLE</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 space-y-2">
                  <strong className="text-[11px] font-bold text-slate-700 block">Explicit Money Movement Actions:</strong>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={async () => {
                        const headers = token ? { Authorization: `Bearer ${token}` } : {};
                        await axios.post(`${AUTH_API}/api/users/admin/deletion-requests/${selectedRequest.request_id}/financial-action`, {
                          action: 'SETTLE_EARNINGS',
                          amount_paise: selectedRequest.financial_snapshot?.earnings_owed_paise || 850000,
                          reason: 'Earnings payout initiated by admin',
                        }, { headers });
                        fetchDeletionRequests();
                        setSelectedRequest(null);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-sm"
                    >
                      [ Initiate Settlement ]
                    </button>
                    <button
                      onClick={async () => {
                        const headers = token ? { Authorization: `Bearer ${token}` } : {};
                        await axios.post(`${AUTH_API}/api/users/admin/deletion-requests/${selectedRequest.request_id}/financial-action`, {
                          action: 'REFUND_PURCHASED_WALLET',
                          amount_paise: selectedRequest.financial_snapshot?.purchased_wallet_paise || 100000,
                          reason: 'Eligible purchased wallet refund approved',
                        }, { headers });
                        fetchDeletionRequests();
                        setSelectedRequest(null);
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-lg shadow-sm"
                    >
                      [ Refund Purchased Wallet Balance ]
                    </button>
                    <button
                      onClick={async () => {
                        const headers = token ? { Authorization: `Bearer ${token}` } : {};
                        await axios.post(`${AUTH_API}/api/users/admin/deletion-requests/${selectedRequest.request_id}/financial-action`, {
                          action: 'FORFEIT_PROMOTIONAL_CREDIT',
                          amount_paise: selectedRequest.financial_snapshot?.promotional_credit_paise || 30000,
                          reason: 'Promotional credit non-refundable per terms',
                        }, { headers });
                        fetchDeletionRequests();
                        setSelectedRequest(null);
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded-lg shadow-sm"
                    >
                      [ Forfeit Promotional Credit ]
                    </button>
                    <button
                      onClick={async () => {
                        const headers = token ? { Authorization: `Bearer ${token}` } : {};
                        await axios.post(`${AUTH_API}/api/users/admin/deletion-requests/${selectedRequest.request_id}/financial-action`, {
                          action: 'OFFSET_LIABILITY',
                          amount_paise: selectedRequest.financial_snapshot?.outstanding_liability_paise || 100000,
                          reason: 'Outstanding liability offset against wallet balance',
                        }, { headers });
                        fetchDeletionRequests();
                        setSelectedRequest(null);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] rounded-lg shadow-sm"
                    >
                      [ Offset Liability ]
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div>
              <strong className="text-xs font-bold text-slate-700 block mb-2">Audit Trail Events:</strong>
              <div className="space-y-2">
                {selectedRequest.audit_trail?.map((evt: any, idx: number) => (
                  <div key={idx} className="p-2.5 bg-slate-50 rounded-xl text-xs flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-800">{evt.status}</span>
                      {evt.note && <p className="text-slate-500 text-[11px]">{evt.note}</p>}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
