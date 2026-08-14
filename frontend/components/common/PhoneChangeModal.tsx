"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Smartphone, ShieldCheck, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { apiClient } from "@/config/api";

interface PhoneChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPhone?: string;
  onSuccess?: (maskedPhone: string) => void;
}

type Step = "input" | "otp" | "success" | "unavailable";

const PhoneChangeModal: React.FC<PhoneChangeModalProps> = ({ isOpen, onClose, currentPhone, onSuccess }) => {
  const [step, setStep] = useState<Step>("input");
  const [newPhone, setNewPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [changesToday, setChangesToday] = useState(0);
  const [maxChanges, setMaxChanges] = useState(2);
  const [maskedResult, setMaskedResult] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch status on open
  useEffect(() => {
    if (!isOpen) return;
    setStep("input");
    setNewPhone("");
    setOtp(["", "", "", "", "", ""]);
    setError("");
    setCooldown(0);

    setStatusLoading(true);
    apiClient.get("/users/phone/change/status")
      .then(res => {
        const d = res.data;
        setChangesToday(d.changes_today ?? 0);
        setMaxChanges(d.max_changes ?? 2);
        if (!d.available) setStep("unavailable");
      })
      .catch(() => {
        // If status fetch fails, allow attempt — backend will enforce
      })
      .finally(() => setStatusLoading(false));

    return () => { if (cooldownRef.current !== null) clearInterval(cooldownRef.current); };
  }, [isOpen]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownRef.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) {
          if (cooldownRef.current !== null) clearInterval(cooldownRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => { if (cooldownRef.current !== null) clearInterval(cooldownRef.current); };
  }, [cooldown]);

  const handleRequestOtp = useCallback(async () => {
    setError("");
    const cleaned = newPhone.replace(/\D/g, "");
    if (cleaned.length < 10 || cleaned.length > 15) {
      setError("Please enter a valid phone number.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post("/users/phone/change/request-otp", { new_phone: newPhone });
      setStep("otp");
      setCooldown(60);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to send OTP. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [newPhone]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0) return;
    setError("");
    setLoading(true);
    try {
      await apiClient.post("/users/phone/change/request-otp", { new_phone: newPhone });
      setCooldown(60);
      setOtp(["", "", "", "", "", ""]);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to resend OTP.");
    } finally {
      setLoading(false);
    }
  }, [newPhone, cooldown]);

  const handleVerifyOtp = useCallback(async () => {
    const otpStr = otp.join("");
    if (otpStr.length !== 6) { setError("Please enter the complete 6-digit OTP."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await apiClient.post("/users/phone/change/verify-otp", { otp: otpStr });
      setMaskedResult(res.data.phone || "");
      setStep("success");
      onSuccess?.(res.data.phone || "");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Verification failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [otp, onSuccess]);

  const handleOtpChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[index] = val.slice(-1);
    setOtp(next);
    if (val && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#1D2B83]">
              <Smartphone size={24} />
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors">
              <X size={20} />
            </button>
          </div>

          {statusLoading ? (
            <div className="flex flex-col items-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#1D2B83]" />
              <p className="text-sm font-medium text-slate-400">Checking availability...</p>
            </div>
          ) : step === "unavailable" ? (
            /* ── UNAVAILABLE ── */
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Unavailable</h3>
              <p className="text-sm font-medium text-slate-500">
                You&apos;ve reached today&apos;s phone number change limit ({changesToday}/{maxChanges}).
                <br />Please try again tomorrow.
              </p>
              <button
                onClick={onClose}
                className="w-full py-3.5 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all mt-2"
              >
                Got it
              </button>
            </div>
          ) : step === "success" ? (
            /* ── SUCCESS ── */
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Phone Updated</h3>
              <p className="text-sm font-medium text-slate-500">
                Your phone number has been changed to<br />
                <span className="font-black text-slate-900">{maskedResult}</span>
              </p>
              <button
                onClick={onClose}
                className="w-full py-3.5 bg-[#1D2B83] text-white font-black rounded-2xl shadow-lg shadow-blue-900/20 hover:opacity-90 transition-all mt-2"
              >
                Done
              </button>
            </div>
          ) : step === "otp" ? (
            /* ── OTP VERIFICATION ── */
            <div className="space-y-6 text-center">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Verify OTP</h3>
                <p className="text-sm font-medium text-slate-500 mt-1">
                  Enter the 6-digit code sent to <span className="font-bold text-slate-700">{newPhone}</span>
                </p>
              </div>

              <div className="flex justify-between gap-2">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    className="w-12 h-14 bg-slate-50 border-2 border-slate-100 rounded-xl text-center text-xl font-black text-[#1D2B83] focus:border-[#1D2B83] focus:bg-white transition-all outline-none"
                  />
                ))}
              </div>

              {error && (
                <p className="text-xs text-red-500 font-bold px-1">{error}</p>
              )}

              <button
                onClick={handleVerifyOtp}
                disabled={loading || otp.some(d => !d)}
                className="w-full py-4 bg-[#1D2B83] text-white font-black rounded-2xl shadow-lg shadow-blue-900/20 hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : "Verify & Change"}
              </button>

              <button
                onClick={handleResend}
                disabled={cooldown > 0 || loading}
                className="text-xs font-black text-[#1D2B83] hover:opacity-70 uppercase tracking-widest disabled:opacity-40"
              >
                {cooldown > 0 ? `Resend Code in 0:${cooldown.toString().padStart(2, "0")}` : "Resend Code"}
              </button>
            </div>
          ) : (
            /* ── INPUT NEW PHONE ── */
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Change Phone Number</h3>
                <p className="text-sm font-medium text-slate-500 mt-1">
                  Enter your new phone number to receive a verification code.
                </p>
              </div>

              {currentPhone && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Number</p>
                    <p className="text-sm font-bold text-slate-900">{currentPhone}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="relative">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="tel"
                    placeholder="New phone number (e.g. +919876543210)"
                    value={newPhone}
                    onChange={e => { setNewPhone(e.target.value); setError(""); }}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:border-[#1D2B83] focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>
                {error && <p className="text-xs text-red-500 font-bold px-1">{error}</p>}
              </div>

              <p className="text-[10px] font-bold text-slate-400 text-center">
                {changesToday}/{maxChanges} changes used today
              </p>

              <button
                onClick={handleRequestOtp}
                disabled={loading || !newPhone.trim()}
                className="w-full py-4 bg-[#1D2B83] text-white font-black rounded-2xl shadow-lg shadow-blue-900/20 hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : "Send OTP"}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default PhoneChangeModal;
