"use client";

import React from "react";
import { FileText } from "lucide-react";
import { FadeIn } from "./FadeIn";

export function PartnerTerms() {
    return (
        <section className="py-20 px-4 bg-white">
            <div className="mx-auto max-w-3xl">
                <FadeIn>
                    <div className="rounded-3xl border border-slate-200 bg-[#F8F7FF] p-10 shadow-soft">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1D2B83]">
                                <FileText className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-extrabold text-slate-900">Terms & Conditions</h2>
                                <p className="text-sm text-slate-500 mt-1">Last updated: April 2025</p>
                            </div>
                        </div>

                        <p className="text-sm text-slate-600 leading-relaxed">
                            By registering as a partner, you agree to maintain professional conduct, deliver
                            services as described, and follow our platform guidelines. Partners must complete
                            identity verification before receiving bookings. ArchitecturalService reserves the right to
                            suspend accounts that violate quality standards or engage in fraudulent activity.
                            Earnings are subject to platform commission. Disputes will be resolved through
                            our mediation process.
                        </p>

                        <button className="mt-4 text-[#1D2B83] text-sm font-semibold underline hover:text-[#16236b] transition-colors">
                            Read Full Terms →
                        </button>
                    </div>
                </FadeIn>
            </div>
        </section>
    );
}
