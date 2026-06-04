"use client";

import React from 'react';
import Link from 'next/link';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const CTA = () => {
    const reveal = useScrollReveal(0.2);

    return (
        <section className="py-24 bg-white">
            <div className="max-w-7xl mx-auto px-6">
                <div
                    ref={reveal.ref}
                    className={`relative overflow-hidden bg-gradient-to-br from-[#1E3A8A] via-blue-900 to-[#1e3a8a] py-20 px-10 md:px-20 rounded-[3rem] text-center text-white shadow-2xl scroll-hidden ${reveal.isVisible ? 'scroll-visible' : ''}`}
                >
                    {/* Decorative Background Elements */}
                    <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-2xl" />
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />

                    {/* Content */}
                    <div className="relative z-10 max-w-3xl mx-auto space-y-8">
                        <h2 className="text-4xl md:text-6xl font-bold leading-[1.1]">
                            Ready to elevate your home?
                        </h2>
                        <p className="text-xl text-blue-100/80 leading-relaxed font-light">
                            Transform your living space today with our curated network
                            of professional service providers. Your dream home is just one click away.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
                            <Link href="/services" className="w-full sm:w-auto px-10 py-4 bg-white text-blue-900 font-bold rounded-full hover:bg-blue-50 transition-all transform hover:scale-105 active:scale-95 shadow-xl text-center">
                                Explore Services
                            </Link>
                            <Link href="/contact" className="w-full sm:w-auto px-10 py-4 border-2 border-white/20 text-white font-bold rounded-full hover:bg-white/10 transition-all transform hover:scale-105 active:scale-95 text-center">
                                Contact Us
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default CTA;
