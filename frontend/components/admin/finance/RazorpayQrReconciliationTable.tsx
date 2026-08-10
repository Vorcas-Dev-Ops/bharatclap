"use client";

import React, { useState, useEffect } from "react";
import { QrCode, ShieldCheck, AlertTriangle, Search, Filter, RefreshCw, CheckCircle2 } from "lucide-react";
import axios from "axios";

interface RazorpayQrReconciliationTableProps {
  token?: string;
}

export default function RazorpayQrReconciliationTable({ token }: RazorpayQrReconciliationTableProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const PAYMENT_API = process.env.NEXT_PUBLIC_PAYMENT_SERVICE_URL || "http://localhost:5005";

  const fetchReconciliationData = async () => {
    try {
      setLoading(true);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await axios.get(
        `${PAYMENT_API}/api/payments/admin/payments/razorpay-qr/reconciliation?search=${searchTerm}&status=${statusFilter}`,
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
    fetchReconciliationData();
  }, [searchTerm, statusFilter, token]);

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-[#1D2B83]" /> Razorpay UPI QR Reconciliation Console
          </h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">
            Audit single-use Razorpay QRs, integer paise amounts, and webhook reconciliation status
          </p>
        </div>

        <button
          onClick={fetchReconciliationData}
          disabled={loading}
          className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Razorpay QR ID or Payment ID..."
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:border-[#1D2B83] outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 outline-none"
          >
            <option value="">All QR Statuses</option>
            <option value="PAID">MATCHED / PAID</option>
            <option value="PENDING">PENDING</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="MISMATCH">MISMATCH (Security Exception)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-medium border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <th className="pb-3">Razorpay QR ID</th>
              <th className="pb-3">Booking ID</th>
              <th className="pb-3">Amount (Paise)</th>
              <th className="pb-3">Display Rupees</th>
              <th className="pb-3">Reconciliation Status</th>
              <th className="pb-3">Payment Ref</th>
              <th className="pb-3">Expiry / Paid At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400 font-bold">
                  No Razorpay QR records found.
                </td>
              </tr>
            ) : (
              records.map((r: any) => (
                <tr key={r._id} className="hover:bg-slate-50/80">
                  <td className="py-3.5 font-mono font-bold text-slate-800">{r.razorpay_qr_id}</td>
                  <td className="py-3.5 font-bold text-slate-700">#{String(r.booking_id).slice(-6)}</td>
                  <td className="py-3.5 font-mono text-slate-600">{r.amount_paise}</td>
                  <td className="py-3.5 font-black text-slate-800">₹{r.display_amount_rupees || (r.amount_paise / 100).toFixed(2)}</td>
                  <td className="py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      r.reconciliation_status === 'MATCHED' || r.status === 'PAID'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : r.status === 'MISMATCH'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200/60 font-black'
                        : r.status === 'EXPIRED'
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-blue-50 text-blue-700'
                    }`}>
                      {r.reconciliation_status || r.status}
                    </span>
                  </td>
                  <td className="py-3.5 font-mono text-[11px] text-slate-500">
                    {r.razorpay_payment_id || '-'}
                  </td>
                  <td className="py-3.5 text-slate-500">
                    {r.paid_at ? new Date(r.paid_at).toLocaleString() : `Expires: ${new Date(r.expires_at).toLocaleTimeString()}`}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
