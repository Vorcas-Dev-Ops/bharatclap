"use client";

import React, { useState, useEffect } from "react";
import { QrCode, CheckCircle2, AlertCircle, RefreshCw, Sparkles, Building2 } from "lucide-react";
import axios from "axios";

interface UpiSetupCardProps {
  token?: string;
}

export default function UpiSetupCard({ token }: UpiSetupCardProps) {
  const [upiId, setUpiId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [upiStatus, setUpiStatus] = useState<"PENDING" | "VERIFIED" | "REJECTED">("PENDING");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const PROVIDER_API = process.env.NEXT_PUBLIC_PROVIDER_SERVICE_URL || "http://localhost:5003";

  const fetchUpiProfile = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${PROVIDER_API}/api/providers/me/payment-profile`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.data) {
        setUpiId(res.data.upiId || "");
        setDisplayName(res.data.displayName || "");
        setUpiStatus(res.data.upiStatus || "PENDING");
      }
    } catch {
      // Fallback defaults
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpiProfile();
  }, [token]);

  const handleSaveAndVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!upiId || !upiId.includes("@")) {
      setErrorMsg("Please enter a valid UPI ID (e.g. yourname@upi)");
      return;
    }

    try {
      setSaving(true);
      const res = await axios.post(
        `${PROVIDER_API}/api/providers/me/upi-profile`,
        { upiId, displayName },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      if (res.data) {
        setUpiStatus(res.data.upiStatus || "VERIFIED");
        setSuccessMsg("UPI ID verified successfully! You are now ready to receive direct booking payments.");
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Failed verifying UPI ID. Please check the handle format.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-[#1D2B83] flex items-center justify-center font-black">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800">Direct Provider UPI QR Setup</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              Receive customer payments directly to your UPI bank account
            </p>
          </div>
        </div>

        {upiStatus === "VERIFIED" ? (
          <span className="px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black flex items-center gap-1.5 border border-emerald-200/60">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            UPI VERIFIED
          </span>
        ) : (
          <span className="px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-black flex items-center gap-1.5 border border-amber-200/60">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            ACTION REQUIRED
          </span>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSaveAndVerify} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
              UPI ID / VPA Handle
            </label>
            <div className="relative">
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. 9876543210@paytm or name@okicici"
                className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-bold text-slate-800 focus:bg-white focus:border-[#1D2B83] outline-none transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
              Display Name on QR
            </label>
            <div className="relative">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Rajesh Kumar Services"
                className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-bold text-slate-800 focus:bg-white focus:border-[#1D2B83] outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-start gap-3">
          <Building2 className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            When a customer chooses <strong className="text-slate-800">Pay Provider</strong>, your dynamic booking QR will encode this UPI handle with the exact job bill amount. Payments settle instantly to your bank account.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 h-12 bg-[#1D2B83] hover:bg-blue-900 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-900/10 transition-all disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Verifying...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Save & Verify UPI Profile
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
