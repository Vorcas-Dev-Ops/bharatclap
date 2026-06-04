"use client";

import React from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const ContactHero = () => {
    const reveal = useScrollReveal(0.15);

    return (
        <section className="relative pt-10 pb-12 overflow-hidden bg-[#F8FAFF]">
            {/* Background Blobs */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-1/4 w-[500px] h-[500px] bg-blue-200/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-200/20 rounded-full blur-[100px]" />
            </div>

            <div
                ref={reveal.ref}
                className={`max-w-4xl mx-auto px-6 relative z-10 text-center space-y-4 scroll-hidden ${reveal.isVisible ? 'scroll-visible' : ''}`}
            >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/50 border border-blue-200 text-blue-600 text-[10px] font-black uppercase tracking-widest mx-auto">
                    Contact Us
                </div>

                <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                    Get In Touch With
                    <span className="text-blue-600"> Our Experts</span>
                </h1>

                <p className="max-w-xl mx-auto text-slate-500 text-[13px] md:text-sm font-medium leading-relaxed">
                    Our consultants are ready to transform your aspirations into a curated reality.
                    Reach out for a bespoke consultation or studio visit.
                </p>
            </div>
        </section>
    );
};

export default ContactHero;
