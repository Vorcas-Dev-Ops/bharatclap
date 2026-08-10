"use client";

import React, { useState, useEffect } from "react";
import { QrCode, CheckCircle2, Clock, Banknote, AlertTriangle, ShieldCheck, RefreshCw, X, ChevronRight } from "lucide-react";
import QRCodeDisplay from "../../common/QRCodeDisplay";
import axios from "axios";

interface ServiceCompletionPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any;
  providerUpiId: string;
  providerDisplayName: string;
  token?: string;
  onPaymentSuccess: (details: any) => void;
}

export default function ServiceCompletionPaymentModal({
  isOpen,
  onClose,
  booking,
  providerUpiId,
  providerDisplayName,
  token,
  onPaymentSuccess,
}: ServiceCompletionPaymentModalProps) {
  const [step, setStep] = useState<"BILL_CONFIRM" | "QR_SCAN" | "CASH_FALLBACK" | "COMPLETED">("BILL_CONFIRM");
  const [additionalCharges, setAdditionalCharges] = useState<number>(0);
  const [collection, setCollection] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60);

  const [cashReason, setCashReason] = useState<string>("CUSTOMER_UPI_UNAVAILABLE");
  const [cashReasonDetails, setCashReasonDetails] = useState<string>("");

  const PAYMENT_API = process.env.NEXT_PUBLIC_PAYMENT_SERVICE_URL || "http://localhost:5005";

  // Countdown timer for 15-min QR expiry
  useEffect(() => {
    if (step !== "QR_SCAN" || !collection?.expiresAt) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(collection.expiresAt).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [step, collection]);

  if (!isOpen || !booking) return null;

  const basePrice = booking.service_price || booking.payable_amount || 0;
  const grandTotal = Math.max(0, basePrice + (Number(additionalCharges) || 0) - (booking.discount_amount || 0));

  const handleGenerateQr = async () => {
    try {
      setLoading(true);
      setErrorMsg("");

      const res = await axios.post(
        `${PAYMENT_API}/api/payments/provider-collection/qr`,
        {
          bookingId: booking._id || booking.booking_id,
          providerId: booking.provider_id,
          customerId: booking.user_id,
          upiId: providerUpiId,
          displayName: providerDisplayName || "BharatClap Partner",
          amountBreakdown: {
            amount: grandTotal,
            serviceAmount: basePrice,
            additionalCharges: Number(additionalCharges) || 0,
            discount: booking.discount_amount || 0,
          },
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      if (res.data?.data) {
        setCollection(res.data.data);
        setStep("QR_SCAN");
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Failed generating payment QR. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleProviderConfirmUpi = async () => {
    if (!collection?._id) return;
    try {
      setLoading(true);
      setErrorMsg("");

      const res = await axios.post(
        `${PAYMENT_API}/api/payments/provider-collection/provider-confirm`,
        { collectionId: collection._id },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      if (res.data?.data) {
        setStep("COMPLETED");
        setTimeout(() => {
          onPaymentSuccess(res.data.data);
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Failed recording payment receipt.");
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateCashFallback = async () => {
    try {
      setLoading(true);
      setErrorMsg("");

      const res = await axios.post(
        `${PAYMENT_API}/api/payments/provider-collection/cash`,
        {
          bookingId: booking._id || booking.booking_id,
          providerId: booking.provider_id,
          customerId: booking.user_id,
          amountBreakdown: {
            amount: grandTotal,
            serviceAmount: basePrice,
            additionalCharges: Number(additionalCharges) || 0,
          },
          reason: cashReason,
          reasonDetails: cashReasonDetails,
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      if (res.data?.data) {
        const cashCol = res.data.data;
        // Provider confirm cash directly
        await axios.post(
          `${PAYMENT_API}/api/payments/provider-collection/cash/provider-confirm`,
          { collectionId: cashCol.collectionId },
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );

        setStep("COMPLETED");
        setTimeout(() => {
          onPaymentSuccess(cashCol);
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Failed initiating cash collection.");
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
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden space-y-0">
        {/* Header */}
        <div className="p-6 bg-[#1D2B83] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide">Collect Service Payment</h3>
              <p className="text-[11px] text-blue-200 font-bold uppercase tracking-wider">
                Booking ID: #{booking.booking_id || String(booking._id).slice(-6)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-all text-white/80">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-4 bg-rose-50 border-b border-rose-100 text-rose-700 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* STEP 1: BILL CONFIRMATION */}
        {step === "BILL_CONFIRM" && (
          <div className="p-6 space-y-6">
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Itemized Bill Summary</h4>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2.5">
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>Base Service Charge</span>
                  <span>₹{basePrice}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>Extra Materials / Additional Charges</span>
                  <div className="flex items-center gap-1">
                    <span>₹</span>
                    <input
                      type="number"
                      value={additionalCharges}
                      onChange={(e) => setAdditionalCharges(Math.max(0, Number(e.target.value)))}
                      className="w-20 h-8 px-2 border border-slate-200 rounded-lg text-right font-black text-slate-800 focus:border-[#1D2B83] outline-none"
                    />
                  </div>
                </div>
                {booking.discount_amount > 0 && (
                  <div className="flex justify-between text-xs font-bold text-emerald-600">
                    <span>Discount</span>
                    <span>-₹{booking.discount_amount}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-black text-slate-800">
                  <span>Final Bill Total</span>
                  <span className="text-lg text-[#1D2B83]">₹{grandTotal}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#1D2B83] shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Clicking <strong className="text-slate-800">Generate Booking QR</strong> will construct a dynamic UPI payment link for ₹{grandTotal} encoded with your verified handle <strong className="text-slate-800">({providerUpiId})</strong>.
              </p>
            </div>

            <button
              onClick={handleGenerateQr}
              disabled={loading}
              className="w-full h-14 bg-[#1D2B83] text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 hover:bg-blue-900 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Generating QR...
                </>
              ) : (
                <>
                  Generate Booking Payment QR <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

        {/* STEP 2: QR SCANNING & PAYEE CONFIRMATION */}
        {step === "QR_SCAN" && (
          <div className="p-6 text-center space-y-6">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 bg-slate-50 px-4 py-2 rounded-xl">
              <span>Dynamic QR Expiry Timer</span>
              <span className={`font-black flex items-center gap-1 ${timeLeft < 180 ? "text-rose-600" : "text-[#1D2B83]"}`}>
                <Clock className="w-3.5 h-3.5" /> {formatTimer(timeLeft)}
              </span>
            </div>

            <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl inline-block shadow-inner">
              {collection?.qrPayload ? (
                <QRCodeDisplay value={collection.qrPayload} size={200} className="mx-auto" />
              ) : (
                <div className="w-48 h-48 bg-slate-200 rounded-2xl flex items-center justify-center text-slate-400 font-bold text-xs">
                  Loading QR...
                </div>
              )}
            </div>

            <div>
              <p className="text-xl font-black text-slate-800">₹{grandTotal}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                Pay to: {providerDisplayName} ({providerUpiId})
              </p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                Ref: {collection?.qrReference}
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={handleProviderConfirmUpi}
                disabled={loading}
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/10 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Customer Has Paid — Confirm Receipt
                  </>
                )}
              </button>

              <button
                onClick={() => setStep("CASH_FALLBACK")}
                className="w-full h-12 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 text-amber-800 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
              >
                <Banknote className="w-4 h-4 text-amber-700" /> Emergency Cash Fallback
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: EMERGENCY CASH FALLBACK */}
        {step === "CASH_FALLBACK" && (
          <div className="p-6 space-y-5">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-1.5">
              <h5 className="text-xs font-black text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> Emergency Cash Fallback
              </h5>
              <p className="text-xs text-amber-700 font-medium leading-relaxed">
                Cash collection is reserved for emergency situations where UPI is unavailable. All cash collections require explicit reason logging.
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                Select Cash Fallback Reason
              </label>
              <select
                value={cashReason}
                onChange={(e) => setCashReason(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-800 focus:border-[#1D2B83] outline-none"
              >
                <option value="CUSTOMER_UPI_UNAVAILABLE">Customer UPI app or bank server unavailable</option>
                <option value="NETWORK_ISSUE">Mobile network / data connectivity failure</option>
                <option value="PROVIDER_QR_UNAVAILABLE">Provider UPI scanner error</option>
                <option value="OTHER">Other emergency exception</option>
              </select>

              <textarea
                value={cashReasonDetails}
                onChange={(e) => setCashReasonDetails(e.target.value)}
                placeholder="Additional notes or clarification..."
                rows={2}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 focus:border-[#1D2B83] outline-none"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setStep("QR_SCAN")}
                className="px-5 h-12 border border-slate-200 text-slate-600 rounded-2xl font-bold text-xs uppercase"
              >
                Back to QR
              </button>
              <button
                onClick={handleInitiateCashFallback}
                disabled={loading}
                className="px-6 h-12 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-amber-900/10 disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Confirm Cash Collection"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: COMPLETED */}
        {step === "COMPLETED" && (
          <div className="p-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-900/10">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-800">Payment Recorded Successfully</h3>
            <p className="text-xs font-medium text-slate-500">
              Booking status updated to <strong className="text-slate-800">COMPLETED</strong>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
