"use client";

import React, { useEffect, useState, useCallback } from "react";
import { connectSocket } from "@/services/socket";
import { ShieldCheck, KeyRound, Copy, CheckCheck, X, Sparkles } from "lucide-react";

import { usePathname } from "next/navigation";

interface OtpPayload {
  type: "start" | "end";
  otp: string;
  bookingId: string;
  bookingRef: string;
}

/**
 * OtpAlertModal — globally mounted, listens for real-time OTP socket events
 * and shows a modal to the authenticated customer. Works on any page.
 */
export default function OtpAlertModal() {
  const [payload, setPayload] = useState<OtpPayload | null>(null);
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(() => setPayload(null), 300); // wait for exit animation
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let socket: any = null;
    let checkInterval: NodeJS.Timeout;

    const handleOtp = (data: OtpPayload) => {
      console.warn("[OtpAlertModal] Received real-time otp_generated event:", data);
      setPayload(data);
      setCopied(false);
      setVisible(true);
    };

    const setupSocketConnection = () => {
      const userData = localStorage.getItem("user");
      if (!userData) {
        console.warn("[OtpAlertModal] No user logged in yet.");
        return;
      }

      let user: any;
      try {
        user = JSON.parse(userData);
      } catch {
        return;
      }

      if (!user?._id) return;

      console.warn(`[OtpAlertModal] User detected: ${user._id}. Setting up socket listener.`);
      socket = connectSocket(user._id, "user");
      socket.off("otp_generated", handleOtp); // avoid duplicate listeners
      socket.on("otp_generated", handleOtp);
    };

    setupSocketConnection();

    // Check again on route change/periodically in case they just logged in
    checkInterval = setInterval(() => {
      if (!socket) {
        setupSocketConnection();
      }
    }, 3000);

    return () => {
      clearInterval(checkInterval);
      if (socket) {
        socket.off("otp_generated", handleOtp);
      }
    };
  }, [pathname]);

  const handleCopy = async () => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload.otp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const el = document.createElement("textarea");
      el.value = payload.otp;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (!payload) return null;

  const isStart = payload.type === "start";
  const typeLabel = isStart ? "Start OTP" : "End OTP";
  const instruction = isStart
    ? "Share this code with the service provider when they arrive and are ready to begin."
    : "Share this code with the service provider only after the service is fully completed to your satisfaction.";
  const accentColor = isStart ? "#1D2B83" : "#0f7a5a";
  const bgGradient = isStart
    ? "from-[#1D2B83]/10 via-blue-50 to-indigo-50"
    : "from-emerald-600/10 via-emerald-50 to-teal-50";
  const badgeBg = isStart ? "bg-[#1D2B83]/10 text-[#1D2B83]" : "bg-emerald-100 text-emerald-700";
  const btnBg = isStart
    ? "bg-[#1D2B83] hover:bg-[#162268]"
    : "bg-emerald-600 hover:bg-emerald-700";

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`fixed z-[9999] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm mx-4 transition-all duration-300 ${
          visible
            ? "opacity-100 scale-100 translate-y-[-50%]"
            : "opacity-0 scale-95 translate-y-[-45%] pointer-events-none"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="otp-modal-title"
      >
        <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
          {/* Decorative gradient header */}
          <div className={`bg-gradient-to-br ${bgGradient} px-6 pt-8 pb-6 text-center`}>
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/70 hover:bg-white text-slate-400 hover:text-slate-600 transition-all shadow-sm"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Animated icon */}
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-lg mb-4"
              style={{ backgroundColor: accentColor }}
            >
              <KeyRound className="h-8 w-8 text-white" strokeWidth={1.5} />
            </div>

            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest mb-3 ${badgeBg}`}>
              <Sparkles className="h-3 w-3" />
              {typeLabel}
            </span>

            <h2 id="otp-modal-title" className="text-lg font-black text-slate-900 mb-1">
              Your OTP is Ready!
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Booking{" "}
              <span className="font-bold text-slate-700">{payload.bookingRef}</span>
            </p>
          </div>

          {/* OTP Display */}
          <div className="px-6 py-6">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center mb-4">
              6-Digit Verification Code
            </p>

            {/* OTP digits */}
            <div className="flex justify-center gap-2 mb-5">
              {payload.otp.split("").map((digit, i) => (
                <div
                  key={i}
                  className="w-11 h-14 flex items-center justify-center rounded-xl text-2xl font-black border-2 shadow-sm"
                  style={{ borderColor: accentColor, color: accentColor, backgroundColor: `${accentColor}08` }}
                >
                  {digit}
                </div>
              ))}
            </div>

            {/* Copy button */}
            <button
              onClick={handleCopy}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-white text-sm font-bold transition-all shadow-lg mb-4 ${btnBg}`}
            >
              {copied ? (
                <>
                  <CheckCheck className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy OTP
                </>
              )}
            </button>

            {/* Instruction */}
            <div className="flex gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-3">
              <ShieldCheck className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 font-medium leading-relaxed">
                {instruction}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
