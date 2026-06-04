"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { API_URL } from '@/config/api';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import Cookies from 'js-cookie';

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get("role") || "customer";

  const [useEmail, setUseEmail] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);

  const validateIdentifier = () => {
    if (useEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(identifier)) {
        return "Please enter a valid email address.";
      }
    } else {
      if (!identifier || !isValidPhoneNumber(identifier)) {
        return "Please enter a valid phone number for the selected country.";
      }
    }
    return "";
  };

  const handleSendOtp = async () => {
    if (!identifier) return;
    const errorMsg = validateIdentifier();
    if (errorMsg) {
      setError(errorMsg);
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/users/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, role, useEmail, mode: 'register' }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to send OTP");

      // The OTP is logged to backend console, but in dev we can also peek at response data
      console.log('OTP sent successfully. Development mode code:', data.otpCode);
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next input
    if (value && index < 5) {
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

  const handleEditIdentifier = () => {
    setOtpSent(false);
    setOtp(["", "", "", "", "", ""]);
    setError("");
  };

  const handleVerifyOtp = async () => {
    const otpValue = otp.join("");
    if (otpValue.length < 6) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/users/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, otp: otpValue, useEmail }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Invalid OTP");

      // Save user session
      localStorage.setItem("token", data.user.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Set cookies for middleware protection
      Cookies.set('token', data.user.token, { expires: 7 });
      Cookies.set('userRole', data.user.role, { expires: 7 });

      // Redirect depending on user role and whether it was a login or new registration
      if (data.user._id === "pending_verification") {
        if (data.user.role === "provider") {
          router.push("/signup/provider");
        } else {
          router.push("/signup/customer");
        }
      } else {
        // This is an existing user logging in
        if (data.user.role === "admin") {
          router.push("/admin/dashboard");
        } else if (data.user.role === "provider") {
          router.push("/provider/dashboard");
        } else {
          router.push("/");
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F8] flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-[480px] bg-white rounded-[2rem] shadow-xl p-8 relative">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="absolute top-8 left-8 text-[#1D2B83] hover:opacity-70 transition-opacity"
        >
          <ArrowLeft className="w-6 h-6" strokeWidth={2.5} />
        </button>

        {/* Header */}
        <div className="text-center mt-12 mb-10">
          <h1 className="text-[32px] font-extrabold text-[#1D2B83] tracking-tight leading-tight">
            Welcome Back
          </h1>
          <p className="mt-2 text-slate-500 font-medium text-[15px]">
            Please enter your credentials to continue.
            {role && <span className="block mt-1 text-xs text-[#1D2B83] font-bold uppercase tracking-widest hidden">Registering as: {role}</span>}
          </p>
        </div>

        {/* Form Container */}
        <div className="space-y-6">
          <input type="hidden" name="role" value={role} />

          {/* Phone / Email Input Group */}
          <div>
            <label className="block text-[10px] font-black tracking-widest text-slate-500 uppercase mb-2">
              {useEmail ? "EMAIL ADDRESS" : "PHONE NUMBER"}
            </label>
            <div className="relative">
              {!useEmail ? (
                <div className={`w-full border-b-2 pb-2 transition-colors ${otpSent ? "opacity-60 cursor-not-allowed" : ""} ${error ? "border-red-400 focus-within:border-red-500" : "border-slate-100 focus-within:border-[#1D2B83]"}`}>
                  <PhoneInput
                    international
                    defaultCountry="IN"
                    value={identifier}
                    onChange={(val) => {
                      setIdentifier(val ? val.toString() : "");
                      if (error) setError("");
                    }}
                    disabled={otpSent}
                    limitMaxLength={true}
                    className="w-full bg-transparent"
                  />
                  <style>{`
                    .PhoneInputInput {
                      border: none !important;
                      outline: none !important;
                      background: transparent;
                      font-size: 15px;
                      font-weight: 500;
                      color: #0f172a;
                    }
                    .PhoneInputInput::placeholder {
                      color: #cbd5e1;
                    }
                    .PhoneInputCountry {
                      margin-right: 12px;
                    }
                    .PhoneInputCountryIcon {
                      width: 24px !important;
                      height: 18px !important;
                      box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
                    }
                    .PhoneInputCountryIconImg {
                      display: block;
                      width: 100%;
                      height: 100%;
                    }
                  `}</style>
                </div>
              ) : (
                <input
                  type="email"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (error) setError("");
                  }}
                  disabled={otpSent}
                  className={`w-full border-b-2 pb-2 text-[15px] font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none transition-colors bg-transparent ${otpSent ? "opacity-60 cursor-not-allowed" : ""} ${error ? "border-red-400 focus:border-red-500" : "border-slate-100 focus:border-[#1D2B83]"}`}
                  placeholder="you@example.com"
                />
              )}
            </div>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                className="text-xs text-red-500 font-medium mt-2 absolute"
              >
                {error}
              </motion.p>
            )}
          </div>

          {/* Toggle Email/Phone */}
          {!otpSent && (
            <div>
              <button
                onClick={() => {
                  setUseEmail(!useEmail);
                  setIdentifier("");
                  setError("");
                }}
                className="text-[#1D2B83] text-sm font-bold hover:underline mt-2"
              >
                Use {useEmail ? "phone number" : "email"} instead
              </button>
            </div>
          )}

          {/* Send OTP Button */}
          <button
            onClick={handleSendOtp}
            disabled={otpSent || !identifier || loading}
            className={`w-full py-4 rounded-2xl font-bold tracking-wide transition-all shadow-md mt-2 ${otpSent || !identifier || loading
              ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
              : "bg-[#1D2B83] text-white hover:bg-[#16226b] hover:shadow-lg hover:shadow-blue-900/20 active:scale-[0.98]"
              }`}
          >
            {loading && !otpSent ? "Sending..." : "Send OTP"}
          </button>


          {/* OTP Section (Visible only after sending OTP) */}
          <AnimatePresence>
            {otpSent && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="pt-8 text-center overflow-hidden"
              >
                <p className="text-sm font-medium mb-6 text-slate-500">
                  Verify the 6-digit code sent to your device
                </p>

                <div className="flex items-center justify-center gap-2 sm:gap-3 mb-8">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-12 h-14 rounded-xl text-center text-2xl font-bold bg-white border-2 border-slate-200 text-[#1D2B83] focus:border-[#1D2B83] focus:bg-white outline-none transition-all shadow-sm hover:border-[#1D2B83]/50"
                    />
                  ))}
                </div>

                <div className="flex items-center justify-center gap-6 mb-8 text-sm font-bold opacity-100">
                  <button 
                    onClick={handleSendOtp}
                    disabled={loading}
                    className="text-[#8B93D6] hover:text-[#1D2B83] disabled:opacity-50"
                  >
                    Resend OTP
                  </button>
                  <button onClick={handleEditIdentifier} className="text-[#8B93D6] hover:text-[#1D2B83]">
                    Edit phone/email
                  </button>
                </div>

                <button
                  onClick={handleVerifyOtp}
                  disabled={otp.some(d => !d) || loading}
                  className={`w-full py-4 rounded-2xl font-bold tracking-wide transition-all shadow-md mt-4 ${otp.some(d => !d) || loading
                    ? "bg-[#F3F4F8] text-white cursor-not-allowed shadow-none"
                    : "bg-[#1D2B83] text-white hover:bg-[#16226b] hover:shadow-lg hover:shadow-blue-900/20 active:scale-[0.98]"
                    }`}
                >
                  {loading && otpSent ? "Verifying..." : "Verify & Continue"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
