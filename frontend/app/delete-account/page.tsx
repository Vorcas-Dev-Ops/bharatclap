"use client";

import React, { useState } from "react";
import { Trash2, AlertTriangle, ShieldCheck, CheckCircle2, Lock, ArrowRight, RefreshCw, Phone, Mail, ExternalLink, FileText } from "lucide-react";
import axios from "axios";

export default function PublicDeleteAccountPage() {
  const [step, setStep] = useState<number>(1); // 1: Identifier, 2: OTP, 3: Warning/Obligations, 4: Confirm, 5: Success
  const [identifier, setIdentifier] = useState("");
  const [useEmail, setUseEmail] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [userId, setUserId] = useState("");
  const [accountType, setAccountType] = useState<"CUSTOMER" | "PROVIDER">("CUSTOMER");
  const [requestId, setRequestId] = useState("");
  const [obligations, setObligations] = useState<string[]>([]);

  const AUTH_API = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || "http://localhost:5001";

  // STEP 1: Send OTP (Anti-Enumeration)
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrorMsg("Please enter your registered mobile number or email.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      await axios.post(`${AUTH_API}/api/users/deletion/request-otp`, {
        identifier: identifier.trim(),
        useEmail,
      });
      setStep(2); // OTP Entry
    } catch {
      // ANTI-ENUMERATION: Still proceed to OTP screen
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.trim().length < 4) {
      setErrorMsg("Please enter a valid verification code.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const res = await axios.post(`${AUTH_API}/api/users/deletion/verify-otp`, {
        identifier: identifier.trim(),
        otp: otpCode.trim(),
        useEmail,
      });

      if (res.data?.verified) {
        if (!res.data?.user_exists) {
          setErrorMsg("Verification complete. No registered account found for these details.");
          return;
        }
        setUserId(res.data.user_id);
        setAccountType(res.data.account_type || "CUSTOMER");
        setStep(3); // Warning & Consequences
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Pre-check & Initiate Deletion
  const handleInitiateDeletion = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await axios.post(`${AUTH_API}/api/users/deletion/initiate`, {
        user_id: userId,
        reason: "Public Web Deletion Page Request",
      });

      if (res.data?.status === "PROCESSING") {
        setRequestId(res.data.request_id);
        setStep(5); // Complete
      }
    } catch (err: any) {
      if (err?.response?.data?.status === "BLOCKED_PENDING_OBLIGATION") {
        setObligations(err.response.data.blocking_obligations || []);
        setRequestId(err.response.data.request_id || "");
        setStep(4); // Blocked Screen
      } else {
        setErrorMsg(err?.response?.data?.message || "Failed initiating account deletion.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      {/* Header Bar */}
      <header className="bg-[#1D2B83] text-white py-4 px-6 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center font-black text-lg">
            B
          </div>
          <div>
            <h1 className="text-base font-black tracking-wide">BharatClap Account Deletion Portal</h1>
            <p className="text-[11px] text-blue-200 font-bold uppercase tracking-wider">
              Google Play Policy Compliance Resource
            </p>
          </div>
        </div>
        <a href="https://bharatclap.com" className="text-xs font-bold text-white/80 hover:text-white">
          Back to Main Site
        </a>
      </header>

      {/* Main Container */}
      <main className="max-w-xl w-full mx-auto p-4 my-8">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
          <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-400" />
              <h2 className="text-sm font-black tracking-wide uppercase">Submit Account Deletion Request</h2>
            </div>
            <span className="text-xs font-bold text-slate-400 bg-white/10 px-3 py-1 rounded-full">
              Step {step} of 5
            </span>
          </div>

          {errorMsg && (
            <div className="p-4 bg-rose-50 border-b border-rose-100 text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* STEP 1: Enter Identifier */}
          {step === 1 && (
            <form onSubmit={handleSendOtp} className="p-6 space-y-5">
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Please enter your registered mobile number or email. You will receive a verification code to authenticate your identity.
              </p>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <label>Verification Channel</label>
                  <button
                    type="button"
                    onClick={() => setUseEmail(!useEmail)}
                    className="text-[#1D2B83] font-bold hover:underline"
                  >
                    Switch to {useEmail ? "Mobile Phone" : "Email Address"}
                  </button>
                </div>

                <div className="relative">
                  {useEmail ? (
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  ) : (
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  )}
                  <input
                    type={useEmail ? "email" : "text"}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={useEmail ? "e.g. customer@example.com" : "e.g. +919876543210"}
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:border-[#1D2B83] outline-none"
                    required
                  />
                </div>
              </div>

              <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-2xl flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#1D2B83] shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-600 font-medium">
                  <strong>Anti-Enumeration Protection:</strong> To safeguard user privacy, this system does not disclose account existence prior to verification.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-[#1D2B83] hover:bg-blue-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-950/20"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Send Verification OTP"}
              </button>
            </form>
          )}

          {/* STEP 2: OTP Verification */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="p-6 space-y-5">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                <p className="text-xs text-blue-900 font-bold">
                  Verification code sent to: <span className="font-mono text-slate-900">{identifier}</span>
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-2 block">Enter 6-Digit OTP</label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456"
                  className="w-full h-12 text-center font-mono font-black tracking-widest text-lg rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#1D2B83] outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Change Mobile / Email
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 h-11 bg-[#1D2B83] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Verify Identity"}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Warning & Confirmation */}
          {step === 3 && (
            <div className="p-6 space-y-5">
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl space-y-1">
                <h4 className="text-xs font-black text-rose-900 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" /> Confirm Account Deletion
                </h4>
                <p className="text-xs text-rose-800 leading-relaxed font-medium">
                  Identified Account Type: <strong className="uppercase">{accountType}</strong>
                </p>
              </div>

              <div className="space-y-3 text-xs text-slate-600">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <strong className="text-slate-900 block mb-0.5">Immediate Deletion</strong>
                  Profile info, avatar, saved addresses, device tokens, and active sessions will be permanently wiped.
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <strong className="text-slate-900 block mb-0.5">Statutory Retention</strong>
                  Tax invoices and accounting records will be retained in anonymized format per RBI & tax regulations.
                </div>
              </div>

              <button
                onClick={handleInitiateDeletion}
                disabled={loading}
                className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-rose-950/20"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Confirm & Delete My Account"}
              </button>
            </div>
          )}

          {/* STEP 4: Blocked Due to Obligations */}
          {step === 4 && (
            <div className="p-6 space-y-5">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-1">
                <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" /> Action Required: Active Obligations Pending
                </h4>
                <p className="text-xs text-amber-800 leading-relaxed font-medium">
                  Your deletion request <strong className="font-mono">#{requestId}</strong> is currently blocked due to active obligations:
                </p>
              </div>

              <ul className="space-y-2">
                {obligations.map((item, idx) => (
                  <li key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                    • {item}
                  </li>
                ))}
              </ul>

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900 flex items-center justify-between">
                <span>Need support resolving these items?</span>
                <a href="https://bharatclap.com/support" target="_blank" rel="noreferrer" className="font-black text-[#1D2B83] flex items-center gap-1 hover:underline">
                  Contact Support <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* STEP 5: Success / Deletion Initiated */}
          {step === 5 && (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-900/10 animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Account Deletion Initiated</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Your request ID is <strong className="text-slate-800 font-mono">#{requestId}</strong>. All active authentication tokens and sessions have been revoked immediately.
              </p>
              <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                Turnaround SLA: Requests are processed within 30 days per Privacy Policy
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 px-6 text-center text-xs font-medium border-t border-slate-800 space-y-2">
        <p>© 2026 BharatClap Services India Pvt Ltd. All rights reserved.</p>
        <p>
          <a href="/privacy" className="hover:underline text-slate-300">Privacy Policy</a> • <a href="/terms" className="hover:underline text-slate-300">Terms of Service</a> • <a href="/support" className="hover:underline text-slate-300">Customer Support</a>
        </p>
      </footer>
    </div>
  );
}
