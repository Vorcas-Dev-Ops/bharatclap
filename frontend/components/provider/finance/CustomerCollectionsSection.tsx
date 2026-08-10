"use client";

import React, { useState, useEffect } from "react";
import { QrCode, Banknote, TrendingUp, AlertCircle, ArrowUpRight, CheckCircle2, RefreshCw, Send } from "lucide-react";
import axios from "axios";

interface CustomerCollectionsSectionProps {
  providerId: string;
  token?: string;
}

export default function CustomerCollectionsSection({ providerId, token }: CustomerCollectionsSectionProps) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>({ upiTotal: 0, cashTotal: 0, grandTotal: 0 });
  const [pendingRemittances, setPendingRemittances] = useState<any[]>([]);
  const [totalPendingCash, setTotalPendingCash] = useState<number>(0);
  const [remittanceRef, setRemittanceRef] = useState<string>("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const PAYMENT_API = process.env.NEXT_PUBLIC_PAYMENT_SERVICE_URL || "http://localhost:5005";

  const fetchFinanceData = async () => {
    if (!providerId) return;
    try {
      setLoading(true);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [historyRes, pendingRes] = await Promise.all([
        axios.get(`${PAYMENT_API}/api/payments/provider-collection/history?providerId=${providerId}`, { headers }),
        axios.get(`${PAYMENT_API}/api/payments/provider-collection/cash/pending-remittance?providerId=${providerId}`, { headers }),
      ]);

      if (historyRes.data?.data?.todaySummary) {
        setSummary(historyRes.data.data.todaySummary);
      }

      if (pendingRes.data?.data) {
        setPendingRemittances(pendingRes.data.data.pendingRemittances || []);
        setTotalPendingCash(pendingRes.data.data.totalPendingAmount || 0);
      }
    } catch {
      // Fallback defaults
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, [providerId, token]);

  const handleSubmitRemittance = async (remittanceId: string) => {
    try {
      setSubmittingId(remittanceId);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await axios.post(
        `${PAYMENT_API}/api/payments/provider-collection/cash/remit`,
        {
          remittanceId,
          remittanceReference: remittanceRef || `REMIT-ONLINE-${Date.now()}`,
        },
        { headers }
      );

      setRemittanceRef("");
      await fetchFinanceData();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed submitting cash remittance");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 3-Concept Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Concept 1: Customer Collections (Gross) */}
        <div className="p-6 bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl shadow-xl shadow-blue-950/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">
              Today's Customer Collections
            </span>
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-3xl font-black">₹{summary.grandTotal}</p>
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-bold text-blue-200">
            <span>UPI: ₹{summary.upiTotal}</span>
            <span>Cash: ₹{summary.cashTotal}</span>
          </div>
        </div>

        {/* Concept 2: Net Earnings */}
        <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Your Net Earnings (After Platform Fee)
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-800">
            ₹{Math.max(0, Math.round(summary.grandTotal * 0.85))}
          </p>
          <p className="text-xs text-slate-400 font-medium">
            Commission auto-deducted from wallet balance
          </p>
        </div>

        {/* Concept 3: Cash Pending Remittance */}
        <div className={`p-6 rounded-3xl border transition-all space-y-3 ${
          totalPendingCash > 0 ? "bg-amber-50/80 border-amber-200 text-amber-900" : "bg-white border-slate-100 text-slate-800"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
              Cash Pending Remittance
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-amber-900">₹{totalPendingCash}</p>
          <p className="text-xs text-amber-700 font-medium">
            {totalPendingCash > 0 ? "Requires deposit or wallet settlement" : "No pending cash dues"}
          </p>
        </div>
      </div>

      {/* Pending Cash Remittances Action List */}
      {pendingRemittances.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" /> Pending Cash Remittances ({pendingRemittances.length})
            </h4>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Due: ₹{totalPendingCash}
            </span>
          </div>

          <div className="space-y-3">
            {pendingRemittances.map((rem: any) => (
              <div key={rem._id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-slate-800">Booking #{String(rem.booking_id).slice(-6)}</p>
                  <p className="text-xs text-slate-500 font-medium">
                    Collected: ₹{rem.amount} on {new Date(rem.collected_at).toLocaleDateString()}
                  </p>
                  <span className={`inline-block mt-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                    rem.status === 'PENDING_REMITTANCE' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {rem.status}
                  </span>
                </div>

                {rem.status === 'PENDING_REMITTANCE' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={remittanceRef}
                      onChange={(e) => setRemittanceRef(e.target.value)}
                      placeholder="Bank UTR / Deposit Ref"
                      className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                    />
                    <button
                      onClick={() => handleSubmitRemittance(rem._id)}
                      disabled={submittingId === rem._id}
                      className="h-10 px-4 bg-[#1D2B83] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-blue-900/10"
                    >
                      {submittingId === rem._id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Submit
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
