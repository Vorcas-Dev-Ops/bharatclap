"use client";

import React from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const ContactMap = () => {
    const reveal = useScrollReveal(0.1);

    return (
        <section className="py-16 md:py-24 bg-[#f5f5f7]">
            <div
                ref={reveal.ref}
                className={`max-w-7xl mx-auto px-6 scroll-hidden ${reveal.isVisible ? 'scroll-visible' : ''}`}
            >
                <div className="relative overflow-hidden rounded-3xl shadow-xl shadow-black/[0.06] border border-gray-100">
                    {/* Map Container */}
                    <div className="relative w-full h-[350px] md:h-[450px]">
                        <iframe
                            title="Architectural Service Location"
                            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3153.0977526509!2d-122.3999!3d37.7857!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80858064e1b0e45f%3A0x6a1b1bc2c5b96af3!2sSan+Francisco%2C+CA+94103!5e0!3m2!1sen!2sus!4v1680000000000!5m2!1sen!2sus"
                            className="absolute inset-0 w-full h-full border-0"
                            allowFullScreen
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            style={{
                                filter: 'grayscale(0.85) contrast(1.05) brightness(1.02)',
                            }}
                        />
                        {/* Center Pin Overlay */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-10 pointer-events-none">
                            <div className="relative">
                                <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full shadow-lg shadow-indigo-500/40 flex items-center justify-center">
                                    <div className="w-3 h-3 bg-white rounded-full" />
                                </div>
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-purple-600" />
                                {/* Pulse ring */}
                                <div className="absolute inset-0 w-8 h-8 bg-indigo-400/30 rounded-full animate-ping" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ContactMap;
