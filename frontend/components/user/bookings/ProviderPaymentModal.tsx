"use client";

import React, { useState, useEffect } from "react";
import { QrCode, Clock, CheckCircle2, ShieldCheck, AlertCircle, RefreshCw, X, Copy } from "lucide-react";
import QRCodeDisplay from "../../common/QRCodeDisplay";
import axios from "axios";

interface ProviderPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: any;
  token?: string;
  onConfirmed: (res: any) => void;
}

export default function ProviderPaymentModal({
  isOpen,
  onClose,
  collection,
  token,
  onConfirmed,
}: ProviderPaymentModalProps) {
  const [utr, setUtr] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60);

  const PAYMENT_API = process.env.NEXT_PUBLIC_PAYMENT_SERVICE_URL || "http://localhost:5005";

  useEffect(() => {
    if (!collection?.expiresAt) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(collection.expiresAt).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [collection]);

  if (!isOpen || !collection) return null;

  const handleCustomerConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    try {
      setLoading(true);
      const res = await axios.post(
        `${PAYMENT_API}/api/payments/provider-collection/customer-confirm`,
        {
          collectionId: collection.collectionId || collection._id,
          transactionReference: utr.trim(),
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      if (res.data?.data) {
        setSuccessMsg("Payment confirmation recorded! Waiting for provider confirmation to complete job.");
        setTimeout(() => {
          onConfirmed(res.data.data);
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Failed recording payment confirmation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden space-y-0">
        {/* Header */}
        <div className="p-6 bg-[#1D2B83] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide">Pay Provider directly via UPI</h3>
              <p className="text-[11px] text-blue-200 font-bold uppercase tracking-wider">
                Ref: {collection.qrReference}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/80">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-4 bg-rose-50 border-b border-rose-100 text-rose-700 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border-b border-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            {successMsg}
          </div>
        )}

        <div className="p-6 text-center space-y-5">
          {/* Expiry Header */}
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 bg-slate-50 px-4 py-2 rounded-xl">
            <span>Pay Window Expiry</span>
            <span className={`font-black flex items-center gap-1 ${timeLeft < 180 ? "text-rose-600" : "text-[#1D2B83]"}`}>
              <Clock className="w-3.5 h-3.5" /> {formatTimer(timeLeft)}
            </span>
          </div>

          {/* QR Code Container */}
          <div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl inline-block shadow-inner">
            {collection.qrPayload ? (
              <QRCodeDisplay value={collection.qrPayload} size={180} className="mx-auto" />
            ) : (
              <div className="w-44 h-44 bg-slate-200 rounded-2xl flex items-center justify-center text-slate-400 font-bold text-xs">
                QR Payload Unavailable
              </div>
            )}
          </div>

          {/* Amount & Payee */}
          <div>
            <p className="text-2xl font-black text-[#1D2B83]">₹{collection.amount || collection.amount_snapshot?.amount}</p>
            <p className="text-xs font-bold text-slate-700 mt-0.5">
              Payee: {collection.displayName || "Service Partner"} ({collection.upiId || collection.provider_upi_id})
            </p>
          </div>

          {/* UTR Input Form */}
          <form onSubmit={handleCustomerConfirm} className="space-y-4 pt-2 text-left">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                Enter UPI Transaction Reference / UTR (Optional)
              </label>
              <input
                type="text"
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                placeholder="12-digit UTR from GPay / PhonePe / Paytm"
                className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:border-[#1D2B83] outline-none"
              />
            </div>

            <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#1D2B83] shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                Your payment will be marked as <strong className="text-slate-800">CONFIRMED</strong> upon dual confirmation by you and the provider.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-13 bg-[#1D2B83] hover:bg-blue-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-900/10 transition-all disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> I Have Completed Payment
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
