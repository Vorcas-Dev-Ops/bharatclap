"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, User, Store, Briefcase, Users, Zap } from "lucide-react";
import { motion } from "framer-motion";

export function PartnerRegistrationSection({ formRef }: { formRef: React.RefObject<HTMLDivElement | null> }) {
    return (
        <section ref={formRef} className="py-24 px-4 bg-white relative overflow-hidden" id="register">
            <div className="mx-auto max-w-5xl text-center relative z-10">
                {/* Title Section */}
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4 flex flex-wrap justify-center items-center gap-x-3"
                >
                    <span>Join the Fixvo</span>
                    <span className="text-[#1D2B83] relative inline-block">
                        Partner Network
                        <svg className="absolute w-full h-3 -bottom-1 left-0 text-blue-600" viewBox="0 0 100 10" preserveAspectRatio="none">
                            <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="3" fill="transparent" strokeLinecap="round" />
                        </svg>
                    </span>
                </motion.h2>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="mt-6 text-sm sm:text-base text-slate-500 max-w-2xl mx-auto mb-8 leading-relaxed font-medium"
                >
                    Take your business to the next level. Sign up today to connect with thousands of customers looking for your services.
                </motion.p>

                {/* Main Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                    className="bg-[#FAFBFC] border border-slate-100 p-2 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] mx-auto relative"
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-8 items-center text-left">

                        {/* Left Side: Image Masonry Grid */}
                        <div className="grid grid-cols-2 gap-1">
                            {/* Left Column of Grid */}
                            <div className="flex flex-col gap-3 mt-3">
                                <div className="relative rounded-[1.5rem] overflow-hidden aspect-[4/5] bg-slate-200 shadow-md">
                                    <img src="https://images.unsplash.com/photo-1600486913747-55e5470d6f40?q=80&w=400&auto=format&fit=crop" alt="Partner" className="w-full h-full object-cover" />
                                    <div className="absolute bottom-2 left-2 bg-white p-2 rounded-xl shadow-lg">
                                        <User className="w-4 h-4 text-[#1D2B83]" />
                                    </div>
                                </div>
                                <div className="relative rounded-[1.5rem] overflow-hidden aspect-square bg-slate-200 shadow-md">
                                    <img src="https://images.unsplash.com/photo-1583394838336-acd977736f90?q=80&w=400&auto=format&fit=crop" alt="Partner" className="w-full h-full object-cover" />
                                    <div className="absolute bottom-2 left-2 bg-white p-2 rounded-xl shadow-lg">
                                        <Store className="w-4 h-4 text-[#1D2B83]" />
                                    </div>
                                </div>
                            </div>

                            {/* Right Column of Grid */}
                            <div className="flex flex-col gap-3">
                                <div className="relative rounded-[1.5rem] overflow-hidden aspect-square bg-slate-200 shadow-md">
                                    <img src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=500&auto=format&fit=crop" alt="Partner" className="w-full h-full object-cover" />
                                    <div className="absolute bottom-2 right-2 bg-white p-2 rounded-xl shadow-lg">
                                        <Briefcase className="w-4 h-4 text-[#1D2B83]" />
                                    </div>
                                </div>
                                <div className="relative rounded-[1.5rem] overflow-hidden aspect-[4/5] bg-slate-200 shadow-md">
                                    <img src="https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?q=80&w=400&auto=format&fit=crop" alt="Partner" className="w-full h-full object-cover" />
                                    <div className="absolute bottom-2 right-2 bg-white p-2 rounded-xl shadow-lg">
                                        <Users className="w-4 h-4 text-[#1D2B83]" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Timeline & CTA */}
                        <div className="flex flex-col h-full justify-center lg:pl-4">
                            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-800 mb-6">Fast & Simple Onboarding</h3>

                            <div className="relative space-y-5 mb-8">
                                {/* Vertical Dashed Line */}
                                <div className="absolute left-3 top-3 bottom-3 w-px border-l-2 border-dashed border-emerald-300/60 z-0"></div>

                                {[
                                    "Create your partner profile",
                                    "Verify your identity via OTP",
                                    "Set up your service portfolio",
                                    "Start receiving bookings!"
                                ].map((step, idx) => (
                                    <div key={idx} className="relative flex items-center gap-4 z-10">
                                        <div className="w-6 h-6 rounded-full bg-emerald-50 border-[2px] border-emerald-500 flex items-center justify-center flex-shrink-0">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                        </div>
                                        <span className="font-bold text-slate-600 text-xs sm:text-sm tracking-wide">{step}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Ready to jump in? Card */}
                            <div className="bg-white p-6 sm:p-8 rounded-[1.5rem] shadow-[0_12px_40px_rgb(0,0,0,0.06)] border border-slate-100 flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-[#EEF2FF] rounded-2xl flex items-center justify-center mb-3 text-[#1D2B83]">
                                    <Zap className="w-5 h-5 fill-current" />
                                </div>
                                <h4 className="text-base sm:text-lg font-extrabold text-slate-800 mb-1">Ready to jump in?</h4>
                                <p className="text-[10px] sm:text-xs text-slate-500 mb-5 font-medium">Registration takes less than 2 minutes.</p>

                                <Link href="/signup/verify?role=provider" className="w-full">
                                    <button className="w-full group relative flex items-center justify-center overflow-hidden transition-all duration-300 px-5 py-3.5 rounded-xl cursor-pointer active:scale-95 shadow-md shadow-[#1D2B83]/20 hover:shadow-xl hover:shadow-[#1D2B83]/30 bg-[#1D2B83] text-white">
                                        <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] flex items-center gap-2">
                                            REGISTER NOW
                                            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                        </span>
                                    </button>
                                </Link>
                            </div>
                        </div>

                    </div>
                </motion.div>
            </div>
        </section>
    );
}
