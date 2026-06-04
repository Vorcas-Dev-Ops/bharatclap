"use client";

import React, { useState } from "react";
import { 
  Button, 
  Input, 
  Form, 
  App,
  Divider
} from "antd";
import { 
  MailOutlined, 
  LockOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined
} from "@ant-design/icons";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import StickyNavPill from "@/components/common/StickyNavPill";
import { API_URL } from '@/config/api';

const ForgotPasswordForm = () => {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password, 4: Success
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const { message } = App.useApp();

    const handleSendOtp = async (values: any) => {
        try {
            setLoading(true);
            setEmail(values.email);
            const response = await fetch(`${API_URL}/users/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: values.email }),
            });

            const data = await response.json();
            if (response.ok) {
                message.success("OTP sent to your email!");
                setStep(2);
            } else {
                message.error(data.message || "Failed to send OTP");
            }
        } catch (error) {
            message.error("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtpOnly = async () => {
        const otpValue = otp.join("");
        if (otpValue.length < 6) {
            message.error("Please enter the full 6-digit OTP");
            return;
        }

        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/users/verify-reset-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp: otpValue }),
            });

            const data = await response.json();
            if (response.ok) {
                message.success("OTP verified!");
                setStep(3);
            } else {
                message.error(data.message || "Invalid OTP");
            }
        } catch (error) {
            message.error("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (values: any) => {
        const otpValue = otp.join("");
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/users/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    email, 
                    otp: otpValue, 
                    password: values.password 
                }),
            });

            const data = await response.json();
            if (response.ok) {
                setStep(4);
            } else {
                message.error(data.message || "Reset failed");
            }
        } catch (error) {
            message.error("Something went wrong. Please try again.");
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
            const nextInput = document.getElementById(`otp-reset-${index + 1}`);
            nextInput?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            const prevInput = document.getElementById(`otp-reset-${index - 1}`);
            prevInput?.focus();
        }
    };

    // Password validation pattern: at least 6 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;

    return (
        <main className="min-h-screen bg-[#FCF8FF] flex flex-col">
            <StickyNavPill />
            <Navbar />
            
            <div className="flex-grow flex items-center justify-center px-6 py-24 relative overflow-hidden">
                <div className="absolute top-0 right-0 -z-10 translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-100/40 rounded-full blur-3xl opacity-60" />
                <div className="absolute bottom-0 left-0 -z-10 -translate-x-1/2 translate-y-1/2 w-[600px] h-[600px] bg-indigo-50/50 rounded-full blur-3xl opacity-60" />

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="w-full max-w-md"
                >
                    <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-indigo-200/50 p-8 md:p-12 border border-white">
                        
                        <AnimatePresence mode="wait">
                            {step === 1 && (
                                <motion.div
                                    key="step1"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                >
                                    <div className="text-center mb-10">
                                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
                                            Forgot Password?
                                        </h1>
                                        <p className="text-slate-500 font-medium">
                                            Enter your email and we'll send you an OTP to reset your password.
                                        </p>
                                    </div>

                                    <Form layout="vertical" onFinish={handleSendOtp} requiredMark={false}>
                                        <Form.Item
                                            name="email"
                                            rules={[
                                                { required: true, message: 'Please input your email!' },
                                                { type: 'email', message: 'Please enter a valid email!' }
                                            ]}
                                        >
                                            <Input 
                                                prefix={<MailOutlined className="text-slate-400 mr-2" />} 
                                                placeholder="Email Address" 
                                                className="h-14 rounded-2xl bg-slate-50 border-slate-100 hover:border-[#1D2B83] focus:border-[#1D2B83] transition-all text-sm font-medium"
                                            />
                                        </Form.Item>

                                        <Button 
                                            type="primary" 
                                            htmlType="submit" 
                                            loading={loading}
                                            className="w-full h-14 bg-[#1D2B83] rounded-2xl font-bold tracking-wide shadow-xl shadow-blue-900/20 hover:scale-[1.02] transition-all"
                                        >
                                            SEND OTP
                                        </Button>

                                        <div className="mt-8 text-center">
                                            <Link href="/login" className="text-sm font-bold text-slate-500 hover:text-[#1D2B83] flex items-center justify-center gap-2">
                                                <ArrowLeftOutlined /> Back to Login
                                            </Link>
                                        </div>
                                    </Form>
                                </motion.div>
                            )}

                            {step === 2 && (
                                <motion.div
                                    key="step2"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                >
                                    <div className="text-center mb-8">
                                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
                                            Verify OTP
                                        </h1>
                                        <p className="text-slate-500 font-medium">
                                            Sent to <span className="text-slate-900 font-bold">{email}</span>
                                        </p>
                                    </div>

                                    <div className="flex justify-center gap-2 mb-8">
                                        {otp.map((digit, i) => (
                                            <input
                                                key={i}
                                                id={`otp-reset-${i}`}
                                                type="text"
                                                maxLength={1}
                                                value={digit}
                                                onChange={(e) => handleOtpChange(i, e.target.value)}
                                                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                                className="w-12 h-14 rounded-xl text-center text-2xl font-bold bg-white border-2 border-slate-200 text-[#1D2B83] focus:border-[#1D2B83] focus:bg-white outline-none transition-all shadow-sm hover:border-[#1D2B83]/50"
                                            />
                                        ))}
                                    </div>

                                    <Button 
                                        type="primary" 
                                        onClick={handleVerifyOtpOnly}
                                        loading={loading}
                                        className="w-full h-14 bg-[#1D2B83] rounded-2xl font-bold tracking-wide shadow-xl shadow-blue-900/20 hover:scale-[1.02] transition-all"
                                    >
                                        VERIFY OTP
                                    </Button>

                                    <div className="mt-6 text-center">
                                        <button 
                                            onClick={() => setStep(1)}
                                            className="text-xs font-bold text-slate-500 hover:text-[#1D2B83]"
                                        >
                                            Edit email address
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {step === 3 && (
                                <motion.div
                                    key="step3"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                >
                                    <div className="text-center mb-8">
                                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
                                            New Password
                                        </h1>
                                        <p className="text-slate-500 font-medium">
                                            OTP Verified. Please set your new password.
                                        </p>
                                    </div>

                                    <Form layout="vertical" onFinish={handleResetPassword} requiredMark={false}>
                                        <Form.Item
                                            name="password"
                                            label="New Password"
                                            rules={[
                                                { required: true, message: 'Please input your new password!' },
                                                { 
                                                    pattern: passwordRegex, 
                                                    message: 'Password must be at least 6 characters, with uppercase, lowercase, number, and symbol.' 
                                                }
                                            ]}
                                        >
                                            <Input.Password
                                                prefix={<LockOutlined className="text-slate-400 mr-2" />}
                                                placeholder="••••••••"
                                                className="h-14 rounded-2xl bg-slate-50 border-slate-100 hover:border-[#1D2B83] focus:border-[#1D2B83] transition-all text-sm font-medium"
                                            />
                                        </Form.Item>

                                        <Form.Item
                                            name="confirm"
                                            label="Confirm Password"
                                            dependencies={['password']}
                                            rules={[
                                                { required: true, message: 'Please confirm your password!' },
                                                ({ getFieldValue }) => ({
                                                    validator(_, value) {
                                                        if (!value || getFieldValue('password') === value) {
                                                            return Promise.resolve();
                                                        }
                                                        return Promise.reject(new Error('Passwords do not match!'));
                                                    },
                                                }),
                                            ]}
                                        >
                                            <Input.Password
                                                prefix={<LockOutlined className="text-slate-400 mr-2" />}
                                                placeholder="••••••••"
                                                className="h-14 rounded-2xl bg-slate-50 border-slate-100 hover:border-[#1D2B83] focus:border-[#1D2B83] transition-all text-sm font-medium"
                                            />
                                        </Form.Item>

                                        <Button 
                                            type="primary" 
                                            htmlType="submit" 
                                            loading={loading}
                                            className="w-full h-14 bg-[#1D2B83] rounded-2xl font-bold tracking-wide shadow-xl shadow-blue-900/20 hover:scale-[1.02] transition-all"
                                        >
                                            RESET PASSWORD
                                        </Button>
                                    </Form>
                                </motion.div>
                            )}

                            {step === 4 && (
                                <motion.div
                                    key="step4"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center py-4"
                                >
                                    <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <CheckCircleOutlined className="text-4xl text-green-500" />
                                    </div>
                                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
                                        Success!
                                    </h1>
                                    <p className="text-slate-500 font-medium mb-10">
                                        Your password has been reset successfully. You can now log in with your new credentials.
                                    </p>
                                    <Button 
                                        type="primary" 
                                        onClick={() => router.push("/login")}
                                        className="w-full h-14 bg-[#1D2B83] rounded-2xl font-bold tracking-wide shadow-xl shadow-blue-900/20 hover:scale-[1.02] transition-all"
                                    >
                                        BACK TO LOGIN
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>

            <Footer />
        </main>
    );
};

export default ForgotPasswordForm;
