"use client";

import React, { useState } from "react";
import {
    Button,
    Input,
    Checkbox,
    Form,
    App,
    Tabs,
    ConfigProvider
} from "antd";
import {
    MailOutlined,
    LockOutlined,
    PhoneOutlined,
    ArrowLeftOutlined,
    ArrowRightOutlined
} from "@ant-design/icons";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_URL } from '@/config/api';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import Cookies from 'js-cookie';

interface LoginFormProps {
    isModal?: boolean;
    onSuccess?: () => void;
}

const LoginFormContent: React.FC<LoginFormProps> = ({ isModal, onSuccess }) => {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("1"); // 1: Password, 2: OTP
    const { message } = App.useApp();

    // OTP State
    const [useEmail, setUseEmail] = useState(false);
    const [identifier, setIdentifier] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);

    const onFinishPassword = async (values: any) => {
        try {
            setLoading(true);
            console.log(`[AUTH] Attempting login at: ${API_URL}/users/login`);
            
            const response = await fetch(`${API_URL}/users/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: values.email,
                    password: values.password,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                message?.success("Login successful!");
                localStorage.setItem("token", data.token);
                localStorage.setItem("user", JSON.stringify(data));
                
                // Set cookies for middleware protection
                Cookies.set('token', data.token, { expires: 7 }); // Expires in 7 days
                Cookies.set('userRole', data.role, { expires: 7 });

                if (onSuccess) {
                    onSuccess();
                } else {
                    if (data.role?.toLowerCase() === "admin") {
                        router.push("/admin/dashboard");
                    } else if (data.role?.toLowerCase() === "provider") {
                        router.push("/provider/dashboard");
                    } else {
                        router.push("/");
                    }
                }
            } else {
                message?.error(data.message || "Login failed");
            }
        } catch (error: any) {
            console.error("Login error details:", error);
            const errorMsg = error.message === "Failed to fetch" 
                ? "Cannot connect to server. Please ensure the backend is running at " + API_URL 
                : "Something went wrong. Please try again.";
            
            if (message) {
                message.error(errorMsg);
            } else {
                alert(errorMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSendOtp = async () => {
        if (!identifier) return;

        if (useEmail) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(identifier)) {
                message?.error("Please enter a valid email address.");
                return;
            }
        } else if (!isValidPhoneNumber(identifier)) {
            message?.error("Please enter a valid phone number.");
            return;
        }

        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/users/send-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier, useEmail, mode: 'login' }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || "Failed to send OTP");

            message?.success("OTP sent successfully!");
            setOtpSent(true);
        } catch (err: any) {
            message?.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        const otpValue = otp.join("");
        if (otpValue.length < 6) return;

        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/users/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, otp: otpValue, useEmail }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || "Invalid OTP");

            message?.success("Login successful!");
            localStorage.setItem("token", data.user.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            // Set cookies for middleware protection
            Cookies.set('token', data.user.token, { expires: 7 });
            Cookies.set('userRole', data.user.role, { expires: 7 });

            if (onSuccess) {
                onSuccess();
            } else {
                if (data.user._id === "pending_verification") {
                    if (data.user.role === "provider") {
                        router.push("/signup/provider");
                    } else {
                        router.push("/signup/customer");
                    }
                } else {
                    if (data.user.role?.toLowerCase() === "admin") {
                        router.push("/admin/dashboard");
                    } else if (data.user.role?.toLowerCase() === "provider") {
                        router.push("/provider/dashboard");
                    } else {
                        router.push("/");
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
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            const prevInput = document.getElementById(`otp-login-modal-${index - 1}`);
            prevInput?.focus();
        }
    };

    return (
        <div className={`w-full ${isModal ? "" : "max-w-md mx-auto"}`}>
            <div className={`bg-white/80 backdrop-blur-xl rounded-[2.5rem] ${isModal ? "" : "shadow-2xl shadow-indigo-200/50 p-8 md:p-12 border border-white"}`}>
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
                        Welcome Back
                    </h1>
                    <p className="text-slate-500 font-medium">
                        Log in to continue your journey.
                    </p>
                </div>

                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    centered
                    className="mb-8 custom-login-tabs"
                    items={[
                        { key: "1", label: "Password" },
                        { key: "2", label: "OTP" },
                    ]}
                />

                {activeTab === "1" ? (
                    <Form
                        name="login-password-modal"
                        onFinish={onFinishPassword}
                        layout="vertical"
                        requiredMark={false}
                    >
                        <Form.Item
                            name="email"
                            rules={[{ required: true, message: 'Please input your email!' }]}
                        >
                            <Input
                                prefix={<MailOutlined className="text-slate-400 mr-2" />}
                                placeholder="Email Address"
                                className="h-14 rounded-2xl bg-slate-50 border-slate-100 hover:border-indigo-600 focus:border-indigo-600 transition-all text-sm font-medium"
                            />
                        </Form.Item>

                        <Form.Item
                            name="password"
                            rules={[{ required: true, message: 'Please input your password!' }]}
                            className="mb-4"
                        >
                            <Input.Password
                                prefix={<LockOutlined className="text-slate-400 mr-2" />}
                                placeholder="Password"
                                className="h-14 rounded-2xl bg-slate-50 border-slate-100 hover:border-indigo-600 focus:border-indigo-600 transition-all text-sm font-medium"
                            />
                        </Form.Item>

                        <div className="flex items-center justify-between mb-8">
                            <Form.Item name="remember" valuePropName="checked" noStyle>
                                <Checkbox className="text-xs font-bold text-slate-500">Remember me</Checkbox>
                            </Form.Item>
                            <Link href="/forgot-password" title="Forgot Password" className="text-xs font-bold text-indigo-600 hover:underline">
                                Forgot password?
                            </Link>
                        </div>

                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            className="w-full h-14 bg-indigo-600 rounded-2xl font-bold tracking-wide shadow-xl shadow-indigo-900/20 hover:scale-[1.02] transition-all"
                        >
                            SIGN IN
                        </Button>
                    </Form>
                ) : (
                    <div className="space-y-6">
                        {!otpSent ? (
                            <>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black tracking-widest text-slate-500 uppercase">
                                        {useEmail ? "EMAIL ADDRESS" : "PHONE NUMBER"}
                                    </label>
                                    <div className="relative">
                                        {useEmail ? (
                                            <Input
                                                prefix={<MailOutlined className="text-slate-400 mr-2" />}
                                                placeholder="you@example.com"
                                                value={identifier}
                                                onChange={(e) => setIdentifier(e.target.value)}
                                                className="h-14 rounded-2xl bg-slate-50 border-slate-100 hover:border-indigo-600 focus:border-indigo-600 transition-all text-sm font-medium"
                                            />
                                        ) : (
                                            <div className="w-full h-14 px-4 flex items-center bg-slate-50 border border-slate-100 rounded-2xl focus-within:border-indigo-600 transition-all">
                                                <PhoneInput
                                                    international
                                                    defaultCountry="IN"
                                                    value={identifier}
                                                    onChange={(val) => setIdentifier(val ? val.toString() : "")}
                                                    className="w-full bg-transparent outline-none text-sm font-medium"
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        type="link"
                                        onClick={() => { setUseEmail(!useEmail); setIdentifier(""); }}
                                        className="p-0 text-xs font-bold text-indigo-600"
                                    >
                                        Use {useEmail ? "phone number" : "email"} instead
                                    </Button>
                                </div>

                                <Button
                                    type="primary"
                                    onClick={handleSendOtp}
                                    loading={loading}
                                    disabled={!identifier}
                                    className="w-full h-14 bg-indigo-600 rounded-2xl font-bold tracking-wide shadow-xl shadow-indigo-900/20 hover:scale-[1.02] transition-all mt-4"
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
                                <p className="text-sm font-medium mb-6 text-slate-500">
                                    Verify the 6-digit code sent to <br />
                                    <span className="text-slate-900 font-bold">{identifier}</span>
                                </p>

                                <div className="flex justify-center gap-1.5 sm:gap-2 mb-8">
                                    {otp.map((digit, i) => (
                                        <input
                                            key={i}
                                            id={`otp-login-modal-${i}`}
                                            type="text"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleOtpChange(i, e.target.value)}
                                            onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                            className="w-10 h-12 sm:w-12 sm:h-14 rounded-xl text-center text-xl sm:text-2xl font-bold bg-white border-2 border-slate-200 text-indigo-600 focus:border-indigo-600 focus:bg-white outline-none transition-all shadow-sm hover:border-indigo-600/50"
                                        />
                                    ))}
                                </div>

                                <div className="flex flex-col gap-4">
                                    <Button
                                        type="primary"
                                        onClick={handleVerifyOtp}
                                        loading={loading}
                                        className="w-full h-14 bg-indigo-600 rounded-2xl font-bold tracking-wide shadow-xl shadow-indigo-900/20 hover:scale-[1.02] transition-all"
                                    >
                                        VERIFY & SIGN IN
                                    </Button>
                                    <div className="flex items-center justify-center gap-4">
                                        <Button
                                            type="link"
                                            onClick={handleSendOtp}
                                            disabled={loading}
                                            className="text-indigo-600 font-bold text-xs"
                                        >
                                            Resend OTP
                                        </Button>
                                        <Button
                                            type="link"
                                            onClick={() => setOtpSent(false)}
                                            icon={<ArrowLeftOutlined />}
                                            className="text-slate-500 font-bold text-xs"
                                        >
                                            Edit details
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}

                <div className="mt-10 text-center">
                    <p className="text-sm font-medium text-slate-500">
                        Don't have an account?{' '}
                        <Link href="/signup" title="Create Account" className="text-indigo-600 font-bold hover:underline">
                            Create Account
                        </Link>
                    </p>
                </div>
            </div>

            <style jsx global>{`
                .custom-login-tabs .ant-tabs-nav::before {
                    border-bottom: none !important;
                }
                .custom-login-tabs .ant-tabs-tab {
                    font-weight: 700 !important;
                    color: #94a3b8 !important;
                }
                .custom-login-tabs .ant-tabs-tab-active .ant-tabs-tab-btn {
                    color: #4f46e5 !important;
                }
                .custom-login-tabs .ant-tabs-ink-bar {
                    background: #4f46e5 !important;
                    height: 3px !important;
                    border-radius: 3px !important;
                }
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
                <main className="min-h-screen bg-[#FCF8FF] flex flex-col">
                    <div className="flex-grow flex items-center justify-center px-4 sm:px-6 py-12 sm:py-24 relative overflow-hidden">
                        {/* Back to Home Button */}
                        <div className="absolute top-8 left-8 z-50">
                            <Link 
                                href="/" 
                                className="group flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-500/10 transition-all active:scale-95"
                            >
                                <ArrowLeftOutlined className="text-sm group-hover:-translate-x-1 transition-transform" />
                                Back to Home
                            </Link>
                        </div>

                        <div className="absolute top-0 right-0 -z-10 translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-blue-100/40 rounded-full blur-3xl opacity-60" />
                        <div className="absolute bottom-0 left-0 -z-10 -translate-x-1/2 translate-y-1/2 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-indigo-50/50 rounded-full blur-3xl opacity-60" />
                        
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="w-full max-w-md"
                        >
                            <LoginFormContent />
                        </motion.div>
                    </div>
                </main>
            </App>
        </ConfigProvider>
    );
};

export { LoginFormContent };
export default LoginComponent;
