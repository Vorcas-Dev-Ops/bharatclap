"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Phone,
  Mail,
  Lock,
  User,
  Building,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Eye,
  EyeOff
} from "lucide-react";
import { API_URL } from "@/config/api";
import { useAuth } from "@/context/AuthContext";
import { setAuthState } from "@/utils/auth";
import { validatePhone, validateEmail, validatePassword, validateName } from "@/utils/validation";

export default function ProviderRegisterPage() {
  const router = useRouter();
  const { loginSuccess } = useAuth();

  // Wizard state: 1: Phone / OTP input, 2: OTP verification, 3: Account Credentials (Name, Business Name, Password)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form Fields
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // DPDP Consent
  const [termsConsent, setTermsConsent] = useState(true);

  // Status & Error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [verificationToken, setVerificationToken] = useState("");

  // Check if provider is already logged in
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (token && userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u.role === "provider") {
          router.push("/provider/onboarding");
        }
      } catch {}
    }
  }, [router]);

  // Resend OTP countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // ── Step 1: Send OTP ──────────────────────────────────────────────
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");

    const cleanPhone = phone.trim().replace(/[^0-9]/g, "");
    if (cleanPhone.length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!termsConsent) {
      setError("Please agree to BharatClap's Terms of Service & Privacy Policy.");
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
          useEmail: false,
          mode: "register",
          consent: {
            given_at: new Date().toISOString(),
            version: "2026-v1-dpdp",
            terms_accepted: termsConsent,
            marketing_opt_in: true,
          }
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.errors?.[0]?.message || "Failed to send OTP.");
      }

      setStep(2);
      setResendTimer(45);
    } catch (err: any) {
      setError(err.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ────────────────────────────────────────────
  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) val = val.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);

    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpValue = otp.join("").trim();
    if (otpValue.length < 6) {
      setError("Please enter the full 6-digit OTP code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const cleanPhone = phone.trim().replace(/[^0-9]/g, "");
      const formattedPhone = cleanPhone.startsWith("91") && cleanPhone.length === 12
        ? `+${cleanPhone}`
        : cleanPhone.startsWith("+")
        ? cleanPhone
        : `+91${cleanPhone}`;

      const res = await fetch(`${API_URL}/users/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: formattedPhone,
          otp: otpValue,
          useEmail: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Invalid OTP code. Please try again.");
      }

      // Check if user already exists or is new
      if (data.user && data.user._id !== "pending_verification") {
        // User already has an account — log them in
        setAuthState(data.user.token, data.user.role);
        loginSuccess(data.user.token, data.user);
        router.push("/provider/onboarding");
        return;
      }

      // New user — store server-issued registration proof token and move to Step 3
      if (data.verificationToken) {
        setVerificationToken(data.verificationToken);
      }
      setStep(3);
    } catch (err: any) {
      setError(err.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Complete Account Creation ─────────────────────────────
  const handleCompleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const nameErr = validateName(fullName);
    if (nameErr) return setError(nameErr);

    if (email.trim()) {
      const emailErr = validateEmail(email.trim());
      if (emailErr) return setError(emailErr);
    }

    const passErr = validatePassword(password);
    if (passErr) return setError(passErr);

    if (password !== confirmPassword) {
      return setError("Passwords do not match.");
    }

    setLoading(true);
    try {
      const cleanPhone = phone.trim().replace(/[^0-9]/g, "");
      const formattedPhone = cleanPhone.startsWith("91") && cleanPhone.length === 12
        ? `+${cleanPhone}`
        : cleanPhone.startsWith("+")
        ? cleanPhone
        : `+91${cleanPhone}`;

      const registerRes = await fetch(`${API_URL}/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName.trim(),
          phone: formattedPhone,
          email: email.trim() || undefined,
          password: password,
          role: "provider",
          verificationToken: verificationToken || undefined,
        }),
      });

      const data = await registerRes.json();
      if (!registerRes.ok) {
        throw new Error(data.message || data.errors?.[0]?.message || "Registration failed.");
      }

      // Save user session
      const userPayload = {
        _id: data._id || data.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: "provider",
        token: data.token,
      };

      setAuthState(data.token, "provider");
      loginSuccess(data.token, userPayload);

      // Save initial provider profile draft with Business Name
      if (businessName.trim()) {
        try {
          await fetch(`${API_URL}/providers/me`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${data.token}`,
            },
            body: JSON.stringify({
              onboarding_draft: {
                business_name: businessName.trim(),
              },
            }),
          });
        } catch {}
      }

      router.push("/provider/onboarding");
    } catch (err: any) {
      setError(err.message || "Failed to create provider account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <Link href="/" className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
            <Briefcase size={20} />
          </div>
          <span className="text-2xl font-black text-[#1D2B83] tracking-tight">BharatClap</span>
        </Link>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Service Provider Registration
        </h2>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          Step {step} of 3 — {step === 1 ? "Verify Mobile" : step === 2 ? "Enter OTP" : "Create Account"}
        </p>

        {/* Progress bar */}
        <div className="w-full bg-slate-200 h-1.5 rounded-full mt-4 overflow-hidden">
          <div
            className="bg-[#1D2B83] h-full transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-3xl sm:px-10 border border-slate-100 relative">
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold flex items-center gap-2.5">
              <AlertCircle size={16} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* ─── STEP 1: Phone Number Input ─── */}
          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                    +91
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    required
                    autoFocus
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  We will send a 6-digit one-time password (OTP) to this number.
                </p>
              </div>

              {/* DPDP Terms Consent */}
              <div className="flex items-start gap-2.5 pt-1">
                <input
                  id="terms"
                  type="checkbox"
                  checked={termsConsent}
                  onChange={(e) => setTermsConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                />
                <label htmlFor="terms" className="text-[11px] text-slate-500 leading-tight cursor-pointer">
                  I agree to BharatClap&apos;s{" "}
                  <Link href="/terms" className="text-blue-600 font-bold hover:underline">Terms</Link>
                  {" "}and{" "}
                  <Link href="/privacy" className="text-blue-600 font-bold hover:underline">Privacy Policy (DPDP Act 2023)</Link>.
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || phone.length < 10}
                className="w-full py-3.5 bg-[#1D2B83] hover:bg-blue-900 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? "Sending OTP..." : "Send OTP"}
                <ArrowRight size={16} />
              </button>

              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="text-xs text-slate-500 hover:text-blue-600 font-semibold"
                >
                  Already registered as a provider? <span className="text-[#1D2B83] font-bold">Log in here</span>
                </Link>
              </div>
            </form>
          )}

          {/* ─── STEP 2: Verify OTP ─── */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-xs text-slate-600">
                  Enter the 6-digit OTP sent to{" "}
                  <span className="font-bold text-slate-900">+91 {phone}</span>
                </p>
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(""); }}
                  className="mt-1 text-[11px] text-blue-600 font-bold hover:underline"
                >
                  Change Mobile Number
                </button>
              </div>

              {/* OTP 6-box input */}
              <div className="flex justify-between gap-2">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`otp-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-12 h-14 text-center text-xl font-black bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={loading || otp.join("").length < 6}
                className="w-full py-3.5 bg-[#1D2B83] hover:bg-blue-900 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? "Verifying..." : "Verify OTP"}
                <CheckCircle2 size={16} />
              </button>

              <div className="text-center">
                {resendTimer > 0 ? (
                  <p className="text-xs text-slate-400">
                    Resend code in <span className="font-bold text-slate-700">{resendTimer}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    className="text-xs text-blue-600 font-bold hover:underline"
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ─── STEP 3: Complete Account Setup ─── */}
          {step === 3 && (
            <form onSubmit={handleCompleteAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Business / Professional Name
                </label>
                <div className="relative">
                  <Building size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Electrical Services (or Individual)"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <p className="mt-1 text-[10px] text-slate-400">
                  Customers in your area will see this name on service requests.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address (Optional)
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="email"
                    placeholder="ramesh@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Create Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? "Creating Account..." : "Create Account & Continue"}
                <ArrowRight size={16} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
