"use client";

import React, { useState, useEffect } from "react";
import {
    Star, CheckCircle, Zap, Shield, Clock, Award,
    ChevronRight, Crown, Sparkles, ArrowRight,
    ShieldCheck, Wallet, Check, Minus, Info, ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CelebrationModal from "@/components/common/CelebrationModal";
import axios from "axios";
import { API_URL } from "@/config/api";
import { Skeleton } from "antd";
import MembershipPaymentModal from "@/components/user/membership/MembershipPaymentModal";

const benefits = [
    { icon: Wallet, label: "Zero Commission", desc: "Keep 100% of your earnings from bookings." },
    { icon: Star, label: "Premium Placement", desc: "Get listed at the top of search results for better visibility." },
    { icon: Zap, label: "Instant Payouts", desc: "Get your earnings instantly transferred to your bank." },
    { icon: ShieldCheck, label: "Verified Badge", desc: "Build trust with a verified provider badge on your profile." },
    { icon: Award, label: "Priority Support", desc: "24/7 dedicated support team for our Plus providers." },
    { icon: Sparkles, label: "More Leads", desc: "Get 3x more service requests than regular providers." },
];

const comparison = [
    { feature: "Platform Commission", free: "10-15%", premium: "0%" },
    { feature: "Search Visibility", free: "Standard", premium: "Top Priority" },
    { feature: "Instant Payouts", free: false, premium: true },
    { icon: Shield, feature: "Verified Badge", free: false, premium: true },
    { feature: "Priority Support", free: false, premium: true },
];

const faqs = [
    { q: "How does BharatClap Provider Plus work?", a: "Once you subscribe, we stop taking commissions on your jobs. You also get top placement in search results, meaning more jobs and more earnings." },
    { q: "Can I cancel my membership anytime?", a: "Yes, you can cancel your membership at any time. Your benefits will remain active until the end of your current billing cycle." },
    { q: "Are payouts really instant?", a: "Yes! Plus providers get their earnings transferred instantly upon job completion, without standard waiting periods." },
];

const ProviderMembershipPage = () => {
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [isSuccessOpen, setIsSuccessOpen] = useState(false);
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [targetPlan, setTargetPlan] = useState<any>(null);
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

    useEffect(() => {
        fetchMemberships();
    }, []);

    const fetchMemberships = async () => {
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            const res = await axios.get(`${API_URL}/memberships`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            // Filter only active provider memberships
            const activePlans = res.data.filter((p: any) => p.status === 'active' && p.role === 'provider');
            setPlans(activePlans);
            if (activePlans.length > 0) {
                const popular = activePlans.find((p: any) => p.isPopular);
                setSelectedPlan(popular?._id || activePlans[0]._id);
            }
        } catch (error) {
            console.error("Error fetching memberships:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFinalSuccess = () => {
        setIsSuccessOpen(false);
    };

    const getPlanStyles = (index: number) => {
        const styles = [
            { color: "from-slate-700 to-slate-800", iconBg: "bg-blue-50" },
            { color: "from-blue-600 via-blue-500 to-cyan-500", iconBg: "bg-blue-50" },
            { color: "from-indigo-600 to-violet-700", iconBg: "bg-blue-50" }
        ];
        return styles[index % styles.length];
    };

    const getDurationLabel = (duration: string) => {
        switch (duration) {
            case 'monthly': return 'mo';
            case 'quarterly': return '3 mo';
            case 'yearly': return 'yr';
            default: return duration;
        }
    };

    return (
        <div className="text-slate-700 selection:bg-blue-100">

            {/* ── 1. Hero Section ────────────────────────────────────────── */}
            <section className="relative pt-8 pb-10 overflow-hidden bg-gradient-to-b from-blue-100/40 to-transparent -mt-8 -mx-4 lg:-mx-4 mb-1">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
                    <div className="absolute left-1/4 w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-[100px]" />
                    <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-200/20 rounded-full blur-[100px]" />
                </div>

                <div className="max-w-4xl mx-auto px-6 relative z-10 text-center space-y-3">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/50 border border-blue-200 text-blue-600 text-[10px] font-black uppercase tracking-widest"
                    >
                        <Crown className="w-3 h-3" /> Provider Plus
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl font-black text-slate-900 tracking-tight leading-tight"
                    >
                        Grow Your Business with Plus
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-slate-500 text-[12px] md:text-sm font-medium max-w-xl mx-auto leading-relaxed"
                    >
                        Pay zero commissions, get top visibility in search results, and unlock instant payouts with our premium provider plans.
                    </motion.p>
                </div>
            </section>

            {/* ── 2. Pricing Cards ───────────────────────────────────────── */}
            <section id="pricing" className="pb-12 relative px-2 max-w-6xl mx-auto">
                {loading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 h-[480px]">
                                <Skeleton active paragraph={{ rows: 8 }} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                        {plans.map((plan, index) => {
                            const style = getPlanStyles(index);
                            return (
                                <motion.div
                                    key={plan._id}
                                    whileHover={{ y: -8, scale: 1.02 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                    className={`group relative rounded-[2rem] p-6 transition-all duration-500 ease-in-out border overflow-hidden flex flex-col min-h-[480px] h-full bg-white border-blue-200 shadow-xl shadow-slate-200/40 text-slate-800 z-10 hover:bg-gradient-to-br hover:from-blue-600 hover:to-indigo-700 hover:text-white hover:border-transparent hover:shadow-blue-500/30 ${plan.isPopular ? 'ring-2 ring-blue-500/50' : ''}`}
                                >
                                    {/* Header Icon */}
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-4 transition-colors bg-blue-50 group-hover:bg-white/20">
                                        <Crown className="w-4 h-4 transition-colors text-blue-600 group-hover:text-white" />
                                    </div>

                                    {/* Plan Info */}
                                    <div className="mb-4">
                                        <div className="flex justify-between items-start mb-0.5">
                                            <p className="text-[9px] font-black uppercase tracking-widest transition-colors text-slate-400 group-hover:text-blue-100">
                                                {plan.name}
                                            </p>
                                            {plan.isPopular && (
                                                <span className="text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full bg-blue-600 text-white group-hover:bg-white group-hover:text-blue-600">
                                                    Most Popular
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-2xl font-black mb-1 transition-colors text-slate-900 group-hover:text-white">
                                            ₹{plan.price}
                                            <span className="text-[11px] font-bold ml-1 transition-colors text-slate-400 group-hover:text-blue-200">
                                                /{getDurationLabel(plan.duration)}
                                            </span>
                                        </h3>
                                        <p className="text-[10px] font-bold leading-relaxed transition-colors text-slate-500 group-hover:text-blue-100/80 line-clamp-2">
                                            {plan.description}
                                        </p>
                                    </div>

                                    {/* Features List */}
                                    <div className="space-y-3 mb-6 flex-grow">
                                        {plan.features?.map((feat: string, i: number) => (
                                            <div key={i} className="flex items-center gap-2.5">
                                                <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors bg-blue-50 text-blue-600 group-hover:bg-blue-400/30 group-hover:text-white">
                                                    <Check className="w-2.5 h-2.5 font-bold" />
                                                </div>
                                                <span className="text-[11px] font-bold transition-colors text-slate-600 group-hover:text-blue-50">
                                                    {feat}
                                                </span>
                                            </div>
                                        ))}
                                        {plan.benefits?.map((benefit: string, i: number) => (
                                            <div key={`ben-${i}`} className="flex items-center gap-2.5">
                                                <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors bg-blue-50 text-blue-600 group-hover:bg-blue-400/30 group-hover:text-white">
                                                    <Zap className="w-2.5 h-2.5 font-bold" />
                                                </div>
                                                <span className="text-[11px] font-bold transition-colors text-slate-600 group-hover:text-blue-50">
                                                    {benefit}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Action Button */}
                                    <button
                                        onClick={() => {
                                            setTargetPlan(plan);
                                            setIsPaymentOpen(true);
                                        }}
                                        className="w-full py-3 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/10 group-hover:bg-white group-hover:from-white group-hover:to-white group-hover:text-blue-600"
                                    >
                                        {plan.isPopular ? `Choose ${plan.name} Plan` : "Get Started"}
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* ── 3. Benefits Section ─────────────────────────────────────── */}
            <section className="py-8 max-w-6xl mx-auto px-2">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Provider Perks</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {benefits.map((b, i) => (
                        <div
                            key={i}
                            className="group relative p-6 rounded-2xl bg-white border border-slate-100 overflow-hidden transition-all duration-700 hover:shadow-lg z-30 after:content-[''] after:z-0 after:absolute after:h-4 after:w-4 after:bg-blue-50 after:-left-2 after:-bottom-2 after:rounded-full hover:after:scale-[100] after:transition-transform after:duration-700 after:ease-in-out cursor-pointer"
                        >
                            <div className="relative z-10">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors duration-700 bg-blue-50 group-hover:bg-white">
                                    <b.icon className="w-5 h-5 text-blue-600 transition-colors duration-700" />
                                </div>
                                <h3 className="text-sm font-black text-slate-900 mb-1 transition-colors duration-700">
                                    {b.label}
                                </h3>
                                <p className="text-slate-500 text-[11px] font-medium leading-relaxed transition-colors duration-700">
                                    {b.desc}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── 4 & 5. Comparison & Earnings Row ────────────────────────── */}
            <section className="py-12 max-w-6xl mx-auto px-2">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Comparison Column */}
                    <div className="space-y-6">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Platform Comparison</h2>
                        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                            <div className="grid grid-cols-3 p-4 bg-slate-50/50 border-b border-slate-100">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Features</div>
                                <div className="text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Free</div>
                                <div className="text-center text-[9px] font-black text-blue-600 uppercase tracking-widest">Plus</div>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {comparison.map((item, i) => (
                                    <div key={i} className="grid grid-cols-3 p-4 items-center transition-colors duration-200 hover:bg-slate-50/80 group">
                                        <div className="text-[11px] font-bold text-slate-600">{item.feature}</div>
                                        <div className="flex justify-center">
                                            {typeof item.free === 'string' ? (
                                                <span className="text-[11px] font-bold text-slate-400">{item.free}</span>
                                            ) : item.free ? (
                                                <Check className="w-3.5 h-3.5 text-slate-300" />
                                            ) : (
                                                <Minus className="w-3.5 h-3.5 text-slate-200" />
                                            )}
                                        </div>
                                        <div className="flex justify-center">
                                            {typeof item.premium === 'string' ? (
                                                <span className="text-[11px] font-black text-blue-600">{item.premium}</span>
                                            ) : (
                                                <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Savings Column */}
                    <div className="space-y-6">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Boost Your Earnings</h2>
                        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-xl shadow-blue-500/5 h-full flex flex-col justify-between transition-all duration-500 hover:shadow-blue-500/10 hover:border-blue-100">
                            <div className="space-y-4">
                                <p className="text-slate-500 text-xs font-medium">
                                    With 0% commission and more leads, top providers are earning up to ₹50,000 more every month.
                                </p>
                                <div className="flex items-center gap-3">
                                    <div className="px-4 py-2 bg-blue-50 rounded-xl border border-blue-100">
                                        <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Average Income Boost</p>
                                        <p className="text-lg font-black text-blue-600">+45%</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-6 mt-8 space-y-3">
                                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                                    <span className="text-slate-400">Visibility Target</span>
                                    <span className="text-blue-600">3x</span>
                                </div>
                                <div className="h-2 bg-white rounded-full overflow-hidden border border-slate-100">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        whileInView={{ width: '85%' }}
                                        className="h-full bg-blue-600"
                                    />
                                </div>
                                <p className="text-[10px] font-bold text-slate-600 text-center">
                                    Get <span className="text-blue-600 font-black">3x more</span> customer inquiries!
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── 6. FAQ Section ─────────────────────────────────────────── */}
            <section className="py-12 mb-8 max-w-5xl mx-auto px-2">
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Questions?</h2>
                </div>

                <div className="space-y-4">
                    {faqs.map((faq, i) => (
                        <div key={i} className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            <button
                                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                                className="w-full p-5 text-left flex items-center justify-between group"
                            >
                                <span className="font-black text-slate-800 text-sm">{faq.q}</span>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${expandedFaq === i ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600 group-hover:bg-blue-100"
                                    }`}>
                                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${expandedFaq === i ? "rotate-180" : ""}`} />
                                </div>
                            </button>
                            <AnimatePresence>
                                {expandedFaq === i && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="px-5 pb-6 text-slate-500 text-xs md:text-sm leading-relaxed"
                                    >
                                        <div className="pt-2 border-t border-slate-50">
                                            {faq.a}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            </section>

            <MembershipPaymentModal
                isOpen={isPaymentOpen}
                onClose={() => setIsPaymentOpen(false)}
                onSuccess={() => {
                    setIsPaymentOpen(false);
                    setIsSuccessOpen(true);
                }}
                plan={targetPlan}
            />

            <CelebrationModal
                open={isSuccessOpen}
                onClose={handleFinalSuccess}
                title="Welcome to Provider Plus!"
                subtitle={`You are now a premium provider. Enjoy 0% commissions and instant payouts!`}
            />

        </div>
    );
};

export default ProviderMembershipPage;