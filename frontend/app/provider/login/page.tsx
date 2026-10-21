"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  Lock,
  Phone,
  Mail,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  ShieldCheck,
  TrendingUp
} from "lucide-react";
import { API_URL } from "@/config/api";
import { useAuth } from "@/context/AuthContext";
import { setAuthState } from "@/utils/auth";

export default function ProviderLoginPage() {
  const router = useRouter();
  const { loginSuccess } = useAuth();

  const [loginMethod, setLoginMethod] = useState<"password" | "otp">("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // OTP flow states
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [resendTimer, setResendTimer] = useState(0);

  // Status & Errors
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roleWarning, setRoleWarning] = useState<string | null>(null);

  // Resend timer countdown
  React.useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // ── Password Login Handler ──
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setRoleWarning(null);

    if (!identifier.trim()) return setError("Please enter your email or mobile number.");
    if (!password) return setError("Please enter your password.");

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/users/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client": "web",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
        body: JSON.stringify({
          email: identifier.trim(),
          password,
          portal: "provider",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Invalid credentials. Please check your username and password.");
      }

      const userRole = (data.role || data.user?.role)?.toLowerCase();
      if (userRole !== "provider") {
        setRoleWarning(
          "This account is registered as a customer. Please use Customer Login to book and manage your home services."
        );
        return;
      }

      loginSuccess(data);
      router.replace("/provider/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Send OTP Handler ──
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");
    setRoleWarning(null);

    const cleanPhone = identifier.trim().replace(/[^0-9]/g, "");
    if (cleanPhone.length < 10) {
      setError("Please enter a valid 10-digit mobile number for OTP login.");
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = cleanPhone.startsWith("91") && cleanPhone.length === 12
        ? `+${cleanPhone}`
        : cleanPhone.startsWith("+")
        ? cleanPhone
        : `+91${cleanPhone}`;

      const res = await fetch(`${API_URL}/users/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: formattedPhone,
          role: "provider",
          mode: "login",
          useEmail: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to send OTP.");
      }

      setOtpSent(true);
      setResendTimer(45);
    } catch (err: any) {
      setError(err.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  // ── Verify OTP Handler ──
  const handleVerifyOtp = async () => {
    const otpValue = otp.join("").trim();
    if (otpValue.length < 6) {
      setError("Please enter the full 6-digit OTP code.");
      return;
    }

    setLoading(true);
    setError("");
    setRoleWarning(null);

    try {
      const cleanPhone = identifier.trim().replace(/[^0-9]/g, "");
      const formattedPhone = cleanPhone.startsWith("91") && cleanPhone.length === 12
        ? `+${cleanPhone}`
        : cleanPhone.startsWith("+")
        ? cleanPhone
        : `+91${cleanPhone}`;

      const res = await fetch(`${API_URL}/users/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client": "web",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
        body: JSON.stringify({
          identifier: formattedPhone,
          otp: otpValue,
          useEmail: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Invalid OTP code.");
      }

      const userRole = (data.user?.role || data.role)?.toLowerCase();
      if (userRole !== "provider") {
        setRoleWarning(
          "This mobile number belongs to a customer account. Please use Customer Login."
        );
        return;
      }

      loginSuccess(data);
      router.replace("/provider/dashboard");
    } catch (err: any) {
      setError(err.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) val = val.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);

    if (val && index < 5) {
      const nextInput = document.getElementById(`provider-otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`provider-otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 blur-[140px] rounded-full pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6 relative z-10">
        <Link href="/" className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
            <Briefcase size={20} />
          </div>
          <span className="text-2xl font-black text-white tracking-tight">BharatClap</span>
        </Link>

        <div className="inline-block mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
            Partner Portal
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Provider Login
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Access your jobs, service availability, and daily earnings
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700/80 py-8 px-6 shadow-2xl rounded-3xl sm:px-10 space-y-5">
          {/* Role Warning (if customer attempts login on provider portal) */}
          {roleWarning && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs space-y-2 text-amber-200">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <p>{roleWarning}</p>
              </div>
              <Link
                href="/login"
                className="inline-block px-3 py-1.5 bg-amber-500 text-slate-900 font-bold rounded-lg hover:bg-amber-400 transition-colors"
              >
                Go to Customer Login →
              </Link>
            </div>
          )}

          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs font-semibold text-red-300 flex items-center gap-2.5">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Toggle Password vs OTP */}
          <div className="flex bg-slate-900/60 p-1 rounded-2xl border border-slate-700/60">
            <button
              type="button"
              onClick={() => {
                setLoginMethod("password");
                setError("");
                setRoleWarning(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                loginMethod === "password"
                  ? "bg-[#1D2B83] text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Password Login
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMethod("otp");
                setError("");
                setRoleWarning(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                loginMethod === "otp"
                  ? "bg-[#1D2B83] text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Mobile OTP Login
            </button>
          </div>

          {/* ─── Method 1: Password Form ─── */}
          {loginMethod === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Email or Mobile Number
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="Enter email or 10-digit mobile"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-700 rounded-2xl text-xs sm:text-sm font-semibold text-white placeholder-slate-500 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-300">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-[11px] font-bold text-blue-400 hover:underline"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 bg-slate-900/60 border border-slate-700 rounded-2xl text-xs sm:text-sm font-semibold text-white placeholder-slate-500 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? "Signing in..." : "Provider Login"}
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* ─── Method 2: OTP Form ─── */}
          {loginMethod === "otp" && (
            <div className="space-y-4">
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Registered Mobile Number
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold text-xs">
                        +91
                      </span>
                      <input
                        type="tel"
                        maxLength={10}
                        required
                        placeholder="9876543210"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value.replace(/[^0-9]/g, ""))}
                        className="w-full pl-12 pr-4 py-3 bg-slate-900/60 border border-slate-700 rounded-2xl text-sm font-semibold text-white placeholder-slate-500 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || identifier.length < 10}
                    className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? "Sending Code..." : "Send Login OTP"}
                    <ArrowRight size={16} />
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-xs text-slate-300">
                      Enter the 6-digit code sent to <strong className="text-white">+91 {identifier}</strong>
                    </p>
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="text-[11px] text-blue-400 font-bold hover:underline mt-0.5"
                    >
                      Change mobile number
                    </button>
                  </div>

                  <div className="flex justify-between gap-2">
                    {otp.map((d, idx) => (
                      <input
                        key={idx}
                        id={`provider-otp-${idx}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className="w-11 h-13 text-center text-lg font-black bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={loading || otp.join("").length < 6}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? "Verifying..." : "Verify & Access Dashboard"}
                    <CheckCircle2 size={16} />
                  </button>

                  <div className="text-center">
                    {resendTimer > 0 ? (
                      <span className="text-xs text-slate-400">
                        Resend code in <strong className="text-slate-200">{resendTimer}s</strong>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendOtp()}
                        className="text-xs text-blue-400 font-bold hover:underline"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Links Footer */}
          <div className="pt-4 border-t border-slate-700/60 flex flex-col gap-2.5 text-center text-xs">
            <p className="text-slate-400">
              Not registered yet?{" "}
              <Link href="/join-as-provider" className="text-emerald-400 font-bold hover:underline">
                Join as a Service Provider
              </Link>
            </p>

            <p className="text-slate-400">
              Looking to book a service?{" "}
              <Link href="/login" className="text-blue-400 font-bold hover:underline">
                Customer Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
