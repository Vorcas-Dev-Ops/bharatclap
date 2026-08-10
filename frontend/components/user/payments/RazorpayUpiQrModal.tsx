"use client";

import React, { useState, useEffect } from "react";
import { QrCode, Clock, CheckCircle2, ShieldCheck, AlertCircle, RefreshCw, X, Sparkles } from "lucide-react";
import QRCodeDisplay from "@/components/common/QRCodeDisplay";
import axios from "axios";

interface RazorpayUpiQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  token?: string;
  onPaymentSuccess: (details: any) => void;
}

export default function RazorpayUpiQrModal({
  isOpen,
  onClose,
  bookingId,
  token,
  onPaymentSuccess,
}: RazorpayUpiQrModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [qrData, setQrData] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60);
  const [isPaid, setIsPaid] = useState(false);

  const PAYMENT_API = process.env.NEXT_PUBLIC_PAYMENT_SERVICE_URL || "http://localhost:5005";

  // 1. Generate Server-Authoritative QR
  const fetchBookingQr = async () => {
    if (!bookingId) return;
    try {
      setLoading(true);
      setErrorMsg("");

      const res = await axios.post(
        `${PAYMENT_API}/api/payments/razorpay-qr/create`,
        { booking_id: bookingId }, // Send ONLY booking_id to server
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      if (res.data) {
        setQrData(res.data);
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Failed generating dynamic Razorpay QR. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchBookingQr();
    }
  }, [isOpen, bookingId]);

  // 2. Countdown Timer
  useEffect(() => {
    if (!qrData?.expires_at || isPaid) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(qrData.expires_at).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [qrData, isPaid]);

  // 3. Status Polling for Smooth UX
  useEffect(() => {
    if (!isOpen || !bookingId || isPaid) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await axios.get(`${PAYMENT_API}/api/payments/razorpay-qr/status/${bookingId}`);
        if (res.data?.status === 'PAID') {
          setIsPaid(true);
          clearInterval(pollInterval);
          setTimeout(() => {
            onPaymentSuccess(res.data);
          }, 1500);
        }
      } catch {
        // Polling retry
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isOpen, bookingId, isPaid]);

  if (!isOpen || !bookingId) return null;

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
              <h3 className="text-sm font-black tracking-wide">Razorpay UPI QR Payment</h3>
              <p className="text-[11px] text-blue-200 font-bold uppercase tracking-wider">
                Booking ID: #{String(bookingId).slice(-6)}
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

        {isPaid ? (
          <div className="p-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-900/10 animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-800">Payment Successful!</h3>
            <p className="text-xs font-medium text-slate-500">
              Razorpay verified your payment. Updating booking status to <strong className="text-slate-800">PAID</strong>...
            </p>
          </div>
        ) : (
          <div className="p-6 text-center space-y-5">
            {/* Expiry Header */}
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 bg-slate-50 px-4 py-2 rounded-xl">
              <span>QR Expiry Timer</span>
              <span className={`font-black flex items-center gap-1 ${timeLeft < 180 ? "text-rose-600" : "text-[#1D2B83]"}`}>
                <Clock className="w-3.5 h-3.5" /> {formatTimer(timeLeft)}
              </span>
            </div>

            {/* QR Code Container */}
            <div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl inline-block shadow-inner">
              {loading ? (
                <div className="w-48 h-48 flex items-center justify-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#1D2B83]" />
                </div>
              ) : qrData?.qr_payload ? (
                <QRCodeDisplay value={qrData.qr_payload} size={190} className="mx-auto" />
              ) : (
                <div className="w-48 h-48 bg-slate-200 rounded-2xl flex items-center justify-center text-slate-400 font-bold text-xs">
                  Generating QR...
                </div>
              )}
            </div>

            {/* Authoritative Payable Amount Display */}
            <div>
              <p className="text-3xl font-black text-[#1D2B83]">
                ₹{qrData?.display_amount_rupees || (qrData?.amount_paise ? (qrData.amount_paise / 100).toFixed(2) : "0.00")}
              </p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                Scan using Google Pay, PhonePe, Paytm, or any UPI App
              </p>
            </div>

            <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-start gap-2.5 text-left">
              <ShieldCheck className="w-4.5 h-4.5 text-[#1D2B83] shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                This is a <strong className="text-slate-800">single-use fixed amount QR</strong>. Payment status will update automatically upon Razorpay webhook confirmation.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400 pt-1">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#1D2B83]" />
              <span>Waiting for payment completion...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
