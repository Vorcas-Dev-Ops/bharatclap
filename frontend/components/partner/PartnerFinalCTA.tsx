"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { FadeIn } from "./FadeIn";

export function PartnerFinalCTA({ onRegisterClick }: { onRegisterClick: () => void }) {
    return (
        <section className="py-28 px-4">
            <div className="mx-auto max-w-4xl">
                <FadeIn>
                    <div className="relative overflow-hidden rounded-[3rem] bg-gradient-to-br from-[#1D2B83] via-[#2a3a9e] to-[#3b4fc0] p-12 text-center shadow-2xl">
                        {/* Decorative blobs */}
                        <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
                        <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />

                        <div className="relative">
                            <span className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white/80 mb-6">
                                Ready to Begin?
                            </span>
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
                                Start Your Journey Today
                            </h2>
                            <p className="mt-4 text-white/70 text-lg max-w-xl mx-auto">
                                Join 10,000+ professionals already growing their business with ArchitecturalService.
                            </p>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={onRegisterClick}
                                className="mt-10 inline-flex items-center gap-2 rounded-2xl bg-white px-9 py-4 text-base font-extrabold text-[#1D2B83] shadow-lg hover:shadow-xl transition-shadow"
                            >
                                Register Now <ArrowRight className="h-4 w-4" />
                            </motion.button>
                        </div>
                    </div>
                </FadeIn>
            </div>
        </section>
    );
}
