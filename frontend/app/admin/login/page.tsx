"use client";

import React, { useState } from "react";
import { Button, Input, Form, App, ConfigProvider } from "antd";
import { MailOutlined, LockOutlined, SafetyCertificateOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_URL } from '@/config/api';
import { setAuthState } from '@/utils/auth';
import { useAuth } from '@/context/AuthContext';

type Stage = 'credentials' | 'setup_2fa' | 'verify_2fa' | 'recovery';

const AdminLoginPage = () => {
    const router = useRouter();
    const { loginSuccess } = useAuth();
    const { message } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [stage, setStage] = useState<Stage>('credentials');
    const [tempToken, setTempToken] = useState('');
    const [qrCode, setQrCode] = useState('');
    const [totpSecret, setTotpSecret] = useState('');
    const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
    const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);

    // Step 1: Email + Password → get tempToken
    const handleCredentials = async (values: { email: string; password: string }) => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/users/admin/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify(values),
            });
            const data = await res.json();

            if (!res.ok) {
                message.error(data.message || 'Login failed');
                return;
            }

            if (data.token || data.accessToken) {
                completeLogin(data);
                return;
            }

            setTempToken(data.tempToken);

            if (data.requiresTwoFactorSetup) {
                await handleSetup2FA(data.tempToken);
            } else if (data.requiresTwoFactor) {
                setStage('verify_2fa');
            }
        } catch (error: any) {
            message.error(error?.message === 'Failed to fetch'
                ? 'Cannot connect to server.'
                : 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Step 2a: Fetch QR code for first-time setup
    const handleSetup2FA = async (token: string) => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/users/admin/2fa/setup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify({ tempToken: token }),
            });
            const data = await res.json();

            if (!res.ok) {
                message.error(data.message || 'Failed to set up 2FA');
                return;
            }

            setQrCode(data.qrCode);
            setTotpSecret(data.secret);
            setStage('setup_2fa');
        } catch {
            message.error('Failed to set up 2FA');
        } finally {
            setLoading(false);
        }
    };

    // Step 2b: Verify first TOTP code during setup
    const handleVerifySetup = async (values: { code: string }) => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/users/admin/2fa/verify-setup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify({ tempToken, code: values.code }),
            });
            const data = await res.json();

            if (!res.ok) {
                message.error(data.message || 'Invalid code');
                return;
            }

            // Show recovery codes before completing login
            if (data.recoveryCodes) {
                setRecoveryCodes(data.recoveryCodes);
                setShowRecoveryCodes(true);
                // Store data for after user acknowledges recovery codes
                sessionStorage.setItem('_admin_login_data', JSON.stringify(data));
            } else {
                completeLogin(data);
            }
        } catch {
            message.error('Verification failed');
        } finally {
            setLoading(false);
        }
    };

    // Step 3: Verify TOTP on regular login
    const handleVerify2FA = async (values: { code: string }) => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/users/admin/2fa/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify({ tempToken, code: values.code }),
            });
            const data = await res.json();

            if (!res.ok) {
                const msg = data.attemptsRemaining !== undefined
                    ? `Invalid code. ${data.attemptsRemaining} attempts remaining.`
                    : data.message || 'Invalid code';
                message.error(msg);
                return;
            }

            completeLogin(data);
        } catch {
            message.error('Verification failed');
        } finally {
            setLoading(false);
        }
    };

    // Recovery code login
    const handleRecovery = async (values: { recoveryCode: string }) => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/users/admin/2fa/recover`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify({ tempToken, recoveryCode: values.recoveryCode }),
            });
            const data = await res.json();

            if (!res.ok) {
                message.error(data.message || 'Invalid recovery code');
                return;
            }

            completeLogin(data);
        } catch {
            message.error('Recovery failed');
        } finally {
            setLoading(false);
        }
    };

    const completeLogin = (data: any) => {
        const token = data.token || data.accessToken || data.user?.token || data.user?.accessToken;
        const role = data.role || data.user?.role || 'admin';
        setAuthState(token, role);
        loginSuccess(token, { ...data, token, role });
        message.success('Login successful!');
        router.replace('/admin/dashboard');
    };

    const handleAcknowledgeRecoveryCodes = () => {
        setShowRecoveryCodes(false);
        const stored = sessionStorage.getItem('_admin_login_data');
        if (stored) {
            sessionStorage.removeItem('_admin_login_data');
            completeLogin(JSON.parse(stored));
        }
    };

    // ─── Recovery Codes Modal ───
    if (showRecoveryCodes) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8"
                >
                    <div className="text-center mb-6">
                        <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <SafetyCertificateOutlined className="text-2xl text-amber-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Save Your Recovery Codes</h2>
                        <p className="text-sm text-slate-400">
                            These codes can be used to access your account if you lose your authenticator.
                            <strong className="text-amber-400"> They will NOT be shown again.</strong>
                        </p>
                    </div>

                    <div className="bg-slate-800 rounded-xl p-4 mb-6">
                        <div className="grid grid-cols-2 gap-2">
                            {recoveryCodes.map((code, i) => (
                                <code key={i} className="text-sm font-mono text-emerald-400 bg-slate-900 rounded px-3 py-2 text-center">
                                    {code}
                                </code>
                            ))}
                        </div>
                    </div>

                    <Button
                        onClick={() => {
                            navigator.clipboard.writeText(recoveryCodes.join('\n'));
                            message.success('Copied to clipboard!');
                        }}
                        className="w-full mb-3 h-12 bg-slate-800 border-slate-700 text-slate-300 rounded-xl font-semibold hover:bg-slate-700"
                    >
                        Copy All Codes
                    </Button>

                    <Button
                        type="primary"
                        onClick={handleAcknowledgeRecoveryCodes}
                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 border-none rounded-xl font-bold"
                    >
                        I've Saved These Codes — Continue
                    </Button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-900/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-[400px] h-[400px] bg-slate-800/30 rounded-full blur-3xl" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-slate-950/50">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-14 h-14 bg-indigo-600/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <SafetyCertificateOutlined className="text-2xl text-indigo-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">
                            Admin Portal
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {stage === 'credentials' && 'Sign in to BharatClap Admin'}
                            {stage === 'setup_2fa' && 'Set up two-factor authentication'}
                            {stage === 'verify_2fa' && 'Enter your authenticator code'}
                            {stage === 'recovery' && 'Enter a recovery code'}
                        </p>
                    </div>

                    <AnimatePresence mode="wait">
                        {/* ─── Stage: Credentials ─── */}
                        {stage === 'credentials' && (
                            <motion.div key="credentials" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                                <Form onFinish={handleCredentials} layout="vertical" requiredMark={false}>
                                    <Form.Item name="email" rules={[{ required: true, message: 'Email is required' }]}>
                                        <Input
                                            prefix={<MailOutlined className="text-slate-500 mr-2" />}
                                            placeholder="Admin Email"
                                            className="h-12 rounded-xl bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                                        />
                                    </Form.Item>
                                    <Form.Item name="password" rules={[{ required: true, message: 'Password is required' }]}>
                                        <Input.Password
                                            prefix={<LockOutlined className="text-slate-500 mr-2" />}
                                            placeholder="Password"
                                            className="h-12 rounded-xl bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                                        />
                                    </Form.Item>
                                    <Button type="primary" htmlType="submit" loading={loading} className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 border-none rounded-xl font-bold mt-2">
                                        Continue
                                    </Button>
                                </Form>
                            </motion.div>
                        )}

                        {/* ─── Stage: 2FA Setup ─── */}
                        {stage === 'setup_2fa' && (
                            <motion.div key="setup" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                                <div className="text-center mb-6">
                                    {qrCode && (
                                        <img src={qrCode} alt="QR Code" className="w-48 h-48 mx-auto rounded-xl bg-white p-2 mb-4" />
                                    )}
                                    <p className="text-xs text-slate-500 mb-2">Or enter this code manually:</p>
                                    <code className="text-sm font-mono text-indigo-400 bg-slate-800 rounded-lg px-3 py-1.5 select-all">
                                        {totpSecret}
                                    </code>
                                </div>

                                <Form onFinish={handleVerifySetup} layout="vertical" requiredMark={false}>
                                    <Form.Item name="code" rules={[{ required: true, message: 'Enter the 6-digit code' }]}>
                                        <Input
                                            placeholder="6-digit code"
                                            maxLength={6}
                                            className="h-12 rounded-xl bg-slate-800 border-slate-700 text-white text-center text-xl tracking-[0.5em] font-mono placeholder:text-slate-500 placeholder:tracking-normal placeholder:text-sm"
                                        />
                                    </Form.Item>
                                    <Button type="primary" htmlType="submit" loading={loading} className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 border-none rounded-xl font-bold">
                                        Verify & Enable 2FA
                                    </Button>
                                </Form>
                            </motion.div>
                        )}

                        {/* ─── Stage: 2FA Verify ─── */}
                        {stage === 'verify_2fa' && (
                            <motion.div key="verify" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                                <Form onFinish={handleVerify2FA} layout="vertical" requiredMark={false}>
                                    <Form.Item name="code" rules={[{ required: true, message: 'Enter the 6-digit code' }]}>
                                        <Input
                                            placeholder="6-digit code"
                                            maxLength={6}
                                            className="h-12 rounded-xl bg-slate-800 border-slate-700 text-white text-center text-xl tracking-[0.5em] font-mono placeholder:text-slate-500 placeholder:tracking-normal placeholder:text-sm"
                                            autoFocus
                                        />
                                    </Form.Item>
                                    <Button type="primary" htmlType="submit" loading={loading} className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 border-none rounded-xl font-bold">
                                        Verify & Sign In
                                    </Button>
                                </Form>

                                <div className="text-center mt-4">
                                    <Button type="link" onClick={() => setStage('recovery')} className="text-xs text-slate-500 hover:text-indigo-400">
                                        Lost your authenticator? Use a recovery code
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {/* ─── Stage: Recovery ─── */}
                        {stage === 'recovery' && (
                            <motion.div key="recovery" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                                <Form onFinish={handleRecovery} layout="vertical" requiredMark={false}>
                                    <Form.Item name="recoveryCode" rules={[{ required: true, message: 'Enter a recovery code' }]}>
                                        <Input
                                            placeholder="Recovery code (e.g. A1B2C3D4E5)"
                                            className="h-12 rounded-xl bg-slate-800 border-slate-700 text-white text-center font-mono uppercase placeholder:text-slate-500 placeholder:normal-case"
                                        />
                                    </Form.Item>
                                    <Button type="primary" htmlType="submit" loading={loading} className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 border-none rounded-xl font-bold">
                                        Recover Access
                                    </Button>
                                </Form>
                                <div className="text-center mt-4">
                                    <Button type="link" onClick={() => setStage('verify_2fa')} icon={<ArrowLeftOutlined />} className="text-xs text-slate-500 hover:text-indigo-400">
                                        Back to authenticator code
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {stage === 'credentials' && (
                        <div className="text-center mt-6">
                            <Link href="/login" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
                                Not an admin? Customer login →
                            </Link>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default function AdminLoginPageWrapper() {
    return (
        <ConfigProvider
            theme={{
                token: {
                    colorPrimary: '#4f46e5',
                    borderRadius: 12,
                },
            }}
        >
            <App>
                <AdminLoginPage />
            </App>
        </ConfigProvider>
    );
}
