"use client";

import React, { useState, useEffect } from "react";
import {
    Button,
    App,
    ConfigProvider
} from "antd";
import {
    ArrowLeftOutlined
} from "@ant-design/icons";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_URL } from '@/config/api';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { setAuthState } from '@/utils/auth';
import { useAuth } from '@/context/AuthContext';
import { validatePhone } from "@/utils/validation";

interface LoginFormProps {
    isModal?: boolean;
    onSuccess?: () => void;
}

const LoginFormContent: React.FC<LoginFormProps> = ({ isModal, onSuccess }) => {
    const router = useRouter();
    const { user, status, isAuthenticated, loginSuccess } = useAuth();
    const [loading, setLoading] = useState(false);
    const { message } = App.useApp();

    React.useEffect(() => {
        if (!isModal && isAuthenticated && status === 'AUTHENTICATED') {
            const role = user?.role?.toLowerCase();
            let target = '/';
            if (role === 'provider') {
                target = '/provider/dashboard';
            }
            router.replace(target);
        }
    }, [isModal, isAuthenticated, status, user, router]);

    // OTP State
    const [identifier, setIdentifier] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [resendCountdown, setResendCountdown] = useState(0);

    // Resend countdown timer
    useEffect(() => {
        if (resendCountdown <= 0) return;
        const timer = setInterval(() => {
            setResendCountdown(prev => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [resendCountdown]);

    const handleSendOtp = async () => {
        if (!identifier) {
            message?.error("Please enter your mobile number");
            return;
        }

        const err = validatePhone(identifier);
        if (err) {
            message?.error(err);
            return;
        }

        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/users/send-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier, useEmail: false, mode: 'login' }),
            });
            const data = await res.json();

            if (!res.ok) {
                const errMsg = data.errors?.[0]?.message || data.message || "Failed to send OTP";
                throw new Error(errMsg);
            }

            setTimeout(() => message?.success("OTP sent successfully!"), 0);
            setOtpSent(true);
            setResendCountdown(30);
            setOtp(["", "", "", "", "", ""]);
        } catch (err: any) {
            message?.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        const otpValue = otp.join("");
        if (otpValue.length < 6) {
            message?.error("Please enter the complete 6-digit OTP");
            return;
        }

        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/users/verify-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Client': 'web',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify({ identifier, otp: otpValue, useEmail: false }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || "Invalid OTP");

            setTimeout(() => message?.success("Login successful!"), 0);

            // Notify AuthContext with full user session payload
            loginSuccess(data);

            if (onSuccess) {
                onSuccess();
            } else {
                if ((data.user?.id || data.user?._id) === "pending_verification") {
                    if (data.user.role === "provider") {
                        router.push("/provider/onboarding");
                    } else {
                        router.push("/signup/customer");
                    }
                } else {
                    const otpRole = (data.user?.role || data.role)?.toLowerCase();
                    if (otpRole === "provider") {
                        router.replace("/provider/dashboard");
                    } else {
                        router.replace("/");
                    }
                }
            }
        } catch (err: any) {
            message?.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        if (value.length > 1) value = value.slice(-1);
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value && index < 5) {
            const nextInput = document.getElementById(`otp-login-modal-${index + 1}`);
            nextInput?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace") {
            if (!otp[index] && index > 0) {
                const prevInput = document.getElementById(`otp-login-modal-${index - 1}`);
                prevInput?.focus();
            } else {
                const newOtp = [...otp];
                newOtp[index] = "";
                setOtp(newOtp);
            }
        }
    };

    return (
        <div className={`w-full ${isModal ? "" : "h-full flex flex-col"}`} suppressHydrationWarning>
            <div className={`bg-white/80 backdrop-blur-xl rounded-[2rem] ${isModal ? "" : "shadow-xl shadow-indigo-200/40 p-6 sm:p-7 xl:p-8 border border-white h-full flex flex-col justify-between"}`} suppressHydrationWarning>
                <div className="text-center mb-4">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-500/25 text-white font-black text-sm">
                        BC
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-1">
                        Customer Login
                    </h1>
                    <p className="text-slate-500 font-medium text-[11px]">
                        Enter your mobile number to book and manage services
                    </p>
                </div>

                <div className="space-y-4">
                    {!otpSent ? (
                        <>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black tracking-widest text-slate-500 uppercase">
                                    MOBILE NUMBER
                                </label>
                                <div className="relative">
                                    <div className="w-full h-11 sm:h-12 px-3.5 flex items-center bg-slate-50 border border-slate-200 rounded-xl focus-within:border-indigo-600 transition-all">
                                        <PhoneInput
                                            international
                                            defaultCountry="IN"
                                            value={identifier}
                                            onChange={(val) => setIdentifier(val ? val.toString() : "")}
                                            className="w-full bg-transparent outline-none text-sm font-medium"
                                        />
                                    </div>
                                </div>
                            </div>

                            <Button
                                type="primary"
                                onClick={handleSendOtp}
                                loading={loading}
                                disabled={!identifier}
                                className="w-full h-11 sm:h-12 bg-indigo-600 rounded-xl font-bold tracking-wide shadow-md shadow-indigo-900/20 hover:scale-[1.01] transition-all text-xs"
                            >
                                SEND OTP
                            </Button>
                        </>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-center"
                        >
                            <p className="text-xs font-medium mb-4 text-slate-500">
                                Verify the 6-digit code sent to <br />
                                <span className="text-slate-900 font-bold">{identifier}</span>
                            </p>

                            <div className="flex justify-center gap-1.5 sm:gap-2 mb-4">
                                {otp.map((digit, i) => (
                                    <input
                                        key={i}
                                        id={`otp-login-modal-${i}`}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleOtpChange(i, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                        className="w-9 h-11 sm:w-10 sm:h-12 rounded-xl text-center text-lg sm:text-xl font-bold bg-white border-2 border-slate-200 text-indigo-600 focus:border-indigo-600 focus:bg-white outline-none transition-all shadow-sm hover:border-indigo-600/50"
                                    />
                                ))}
                            </div>

                            <div className="flex flex-col gap-3">
                                <Button
                                    type="primary"
                                    onClick={handleVerifyOtp}
                                    loading={loading}
                                    className="w-full h-11 sm:h-12 bg-indigo-600 rounded-xl font-bold tracking-wide shadow-md shadow-indigo-900/20 hover:scale-[1.01] transition-all text-xs"
                                >
                                    VERIFY & SIGN IN
                                </Button>
                                <div className="flex items-center justify-between px-1">
                                    <Button
                                        type="link"
                                        onClick={handleSendOtp}
                                        disabled={loading || resendCountdown > 0}
                                        className="text-indigo-600 font-bold text-[11px] p-0"
                                    >
                                        {resendCountdown > 0 
                                            ? `Resend in 00:${resendCountdown.toString().padStart(2, '0')}`
                                            : "Resend OTP"}
                                    </Button>
                                    <Button
                                        type="link"
                                        onClick={() => {
                                            setOtpSent(false);
                                            setOtp(["", "", "", "", "", ""]);
                                        }}
                                        icon={<ArrowLeftOutlined />}
                                        className="text-slate-500 font-bold text-[11px] p-0"
                                    >
                                        Change number
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Service Professional?</span>
                    <Link href="/provider/login" className="text-indigo-600 font-bold hover:text-indigo-700 hover:underline">
                        Provider Login →
                    </Link>
                </div>

                <div className="mt-2 text-center text-[10px] text-slate-400">
                    By signing in, you agree to our{' '}
                    <Link href="/terms" className="text-indigo-600 font-medium hover:underline">Terms</Link>
                    {' '}&{' '}
                    <Link href="/privacy" className="text-indigo-600 font-medium hover:underline">Privacy Policy</Link>
                </div>
            </div>

            <style jsx global>{`
                .PhoneInputInput {
                    border: none !important;
                    outline: none !important;
                    background: transparent;
                    font-size: 14px;
                    font-weight: 500;
                    color: #0f172a;
                }
            `}</style>
        </div>
    );
};

const LoginComponent = () => {
    return (
        <ConfigProvider
            theme={{
                token: {
                    colorPrimary: '#4f46e5',
                    borderRadius: 16,
                },
            }}
        >
            <App>
                <main className="h-screen max-h-screen overflow-hidden bg-[#FCF8FF] flex flex-col justify-center">
                    <div className="flex-grow flex items-center justify-center px-4 sm:px-6 py-2 sm:py-4 relative overflow-hidden">
                        {/* Back to Home Button */}
                        <div className="absolute top-4 left-4 sm:top-5 sm:left-6 z-50">
                            <Link 
                                href="/" 
                                className="group flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 bg-white/90 backdrop-blur-md border border-slate-100 rounded-xl text-xs font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-500/10 transition-all active:scale-95"
                            >
                                <ArrowLeftOutlined className="text-xs group-hover:-translate-x-1 transition-transform" />
                                Back to Home
                            </Link>
                        </div>

                        <div className="absolute top-0 right-0 -z-10 translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-blue-100/40 rounded-full blur-3xl opacity-60" />
                        <div className="absolute bottom-0 left-0 -z-10 -translate-x-1/2 translate-y-1/2 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-indigo-50/50 rounded-full blur-3xl opacity-60" />
                        
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch"
                        >
                            {/* Left: Customer Login Brand Banner & Image */}
                            <div className="hidden lg:flex flex-col justify-between bg-white/70 backdrop-blur-xl border border-white/80 rounded-[2rem] p-6 sm:p-7 xl:p-8 shadow-xl shadow-indigo-100/50 overflow-hidden relative h-full">
                                <div>
                                    {/* Brand Logo & Name */}
                                    <div className="flex items-center gap-2.5 mb-2.5">
                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-indigo-500/25">
                                            BC
                                        </div>
                                        <div>
                                            <span className="text-xl font-black text-[#1D2B83] tracking-tight">BharatClap</span>
                                            <span className="block text-[9.5px] font-bold text-indigo-600 tracking-wider uppercase">Customer Portal</span>
                                        </div>
                                    </div>

                                    {/* Headline */}
                                    <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-snug mb-1">
                                        Quality Home Services at Your Doorstep
                                    </h2>
                                    <p className="text-xs text-slate-500 font-medium leading-relaxed mb-1">
                                        Sign in to schedule verified pros, track real-time bookings, and enjoy trusted home care.
                                    </p>
                                </div>

                                {/* Customer Image - Dynamic full-width showcase */}
                                <div className="relative rounded-2xl overflow-hidden shadow-sm w-full flex-1 min-h-[170px] max-h-[220px] my-3 group">
                                    <img
                                        src="/images/signup/Customer.jpg"
                                        alt="BharatClap Customer"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src =
                                                "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&auto=format&fit=crop&q=80";
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent flex items-end p-3">
                                        <div className="text-white">
                                            <span className="font-bold flex items-center gap-1 text-amber-300 text-xs">
                                                ★ 4.8 / 5 Rating
                                            </span>
                                            <span className="text-slate-200 text-[10px] block mt-0.5">
                                                Trusted by 50,000+ Happy Households
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Trust Highlights */}
                                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
                                            ✓
                                        </div>
                                        <span className="text-[11px] font-semibold text-slate-700">Verified Pros</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
                                            ⚡
                                        </div>
                                        <span className="text-[11px] font-semibold text-slate-700">Instant OTP Access</span>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Login Form Content */}
                            <div className="w-full h-full flex flex-col">
                                <LoginFormContent />
                            </div>
                        </motion.div>
                    </div>
                </main>
            </App>
        </ConfigProvider>
    );
};

export { LoginFormContent };
export default LoginComponent;
