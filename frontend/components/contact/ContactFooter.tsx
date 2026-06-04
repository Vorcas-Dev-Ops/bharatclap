"use client";

import React from 'react';
import Link from 'next/link';
import { Share2, Star } from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const ContactFooter = () => {
    const reveal = useScrollReveal(0.1);

    return (
        <footer className="bg-[#ededf0] border-t border-gray-200/60 py-12 md:py-16">
            <div
                ref={reveal.ref}
                className={`max-w-7xl mx-auto px-6 scroll-hidden ${reveal.isVisible ? 'scroll-visible' : ''}`}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-12">
                    {/* Brand Column */}
                    <div className="space-y-4 lg:col-span-1">
                        <Link href="/" className="text-xl font-bold text-gray-900 tracking-tight hover:text-indigo-600 transition-colors">
                            FIXVO
                        </Link>
                        <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
                            A curated sanctuary for the home, redefining service through architectural precision.
                        </p>
                    </div>

                    {/* Expertise Column */}
                    <div className="space-y-5">
                        <h4 className="text-sm font-bold text-gray-900 tracking-widest uppercase">
                            Expertise
                        </h4>
                        <ul className="space-y-3">
                            {['Service Areas', 'Expert Partners', 'Trust & Safety'].map((item) => (
                                <li key={item}>
                                    <Link href="#" className="text-gray-500 text-sm hover:text-indigo-600 transition-colors">
                                        {item}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Support Column */}
                    <div className="space-y-5">
                        <h4 className="text-sm font-bold text-gray-900 tracking-widest uppercase">
                            Support
                        </h4>
                        <ul className="space-y-3">
                            {[
                                { label: 'Contact Us', href: '/contact', active: true },
                                { label: 'Privacy Policy', href: '/privacy', active: false },
                                { label: 'Terms of Service', href: '/terms', active: false },
                            ].map((item) => (
                                <li key={item.label}>
                                    <Link
                                        href={item.href}
                                        className={`text-sm transition-colors ${
                                            item.active
                                                ? 'text-gray-900 font-semibold'
                                                : 'text-gray-500 hover:text-indigo-600'
                                        }`}
                                    >
                                        {item.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Social + Copyright Column */}
                    <div className="flex flex-col items-start lg:items-end justify-between gap-6">
                        <div className="flex items-center gap-3">
                            <a
                                href="#"
                                className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:bg-indigo-600 hover:text-white hover:border-indigo-600 text-gray-500 transition-all duration-300 hover:scale-110"
                            >
                                <Share2 size={16} strokeWidth={2} />
                            </a>
                            <a
                                href="#"
                                className="w-10 h-10 rounded-full bg-indigo-600 border border-indigo-600 flex items-center justify-center shadow-sm hover:bg-indigo-700 text-white transition-all duration-300 hover:scale-110"
                            >
                                <Star size={16} strokeWidth={2} />
                            </a>
                        </div>
                        <p className="text-xs text-gray-400 text-right leading-relaxed">
                            © 2026 FIXVO. A Curated
                            <br />
                            Sanctuary for the Home.
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default ContactFooter;
