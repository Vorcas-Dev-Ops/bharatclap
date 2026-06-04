"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { FadeIn } from "./FadeIn";

const FAQS = [
    {
        q: "Is there any registration fee?",
        a: "No! Registering as a partner is completely free. We only take a small commission per completed booking.",
    },
    {
        q: "How and when do I get paid?",
        a: "Payments are processed every week directly to your registered bank account, no delays.",
    },
    {
        q: "What documents do I need to submit?",
        a: "You need a government-issued ID, address proof, bank account details, and any relevant professional certifications.",
    },
    {
        q: "Can I work in multiple cities?",
        a: "Yes, you can set your preferred service areas and expand as your business grows.",
    },
    {
        q: "What if I face an issue with a customer?",
        a: "Our 24/7 support team mediates all disputes fairly and ensures your interests are protected.",
    },
];

function FAQItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div
            className={`rounded-2xl border transition-colors duration-300 cursor-pointer ${open ? "border-[#1D2B83]/30 bg-[#F5F3FF]" : "border-slate-200 bg-white"
                }`}
            onClick={() => setOpen(!open)}
        >
            <div className="flex items-center justify-between px-6 py-4">
                <span
                    className={`text-sm font-semibold ${open ? "text-[#1D2B83]" : "text-slate-800"}`}
                >
                    {q}
                </span>
                <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
                    <ChevronDown className={`h-5 w-5 ${open ? "text-[#1D2B83]" : "text-slate-400"}`} />
                </motion.div>
            </div>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28 }}
                        className="overflow-hidden"
                    >
                        <p className="px-6 pb-4 text-sm text-slate-600 leading-relaxed">{a}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function PartnerFAQ() {
    return (
        <section className="py-24 px-4 bg-white">
            <div className="mx-auto max-w-4xl">
                <FadeIn className="text-center mb-14">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#1D2B83]">
                        Questions & Answers
                    </span>
                    <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900">
                        Frequently Asked Questions
                    </h2>
                </FadeIn>

                <div className="space-y-4">
                    {FAQS.map((faq, i) => (
                        <FadeIn key={i} delay={i * 0.05}>
                            <FAQItem {...faq} />
                        </FadeIn>
                    ))}
                </div>
            </div>
        </section>
    );
}
