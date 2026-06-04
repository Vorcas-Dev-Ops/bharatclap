"use client";

import React from 'react';
import Image from 'next/image';

const AboutHero = () => {
    return (
        <section className="relative pt-20 sm:pt-32 pb-12 sm:pb-20 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                {/* Text Content */}
                <div className="text-center mb-8 sm:mb-12 animate-fade-in-up">
                    <span className="inline-block px-4 py-1.5 rounded-full bg-blue-50 text-[#1E3A8A] text-xs sm:text-sm font-semibold tracking-wider mb-4 sm:mb-6 uppercase">
                        Our Story
                    </span>
                    <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-gray-900 leading-[1.1] mb-4 sm:mb-6">
                        Crafting a Curated Sanctuary for <br className="hidden md:block" />
                        <span className="text-[#1E3A8A]">Your Home.</span>
                    </h1>
                    <p className="max-w-2xl mx-auto text-sm sm:text-lg text-gray-500 leading-relaxed">
                        We believe every space tells a story. At ArchitecturalService, we blend precision engineering
                        with artistic vision to transform your living spaces into masterpieces.
                    </p>
                </div>

                {/* Hero Image Section */}
                <div className="relative group max-w-7xl mx-auto">
                    <div className="relative aspect-[16/9] w-full rounded-[2.5rem] overflow-hidden shadow-2xl transition-transform duration-700 group-hover:scale-[1.01]">
                        <Image
                            src="/images/about/hero.jpg"
                            alt="Modern interior design"
                            fill
                            sizes="100vw"
                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                            priority
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    </div>
                </div>
            </div>

            {/* Background decorative blobs */}
            <div className="absolute top-0 right-0 -z-10 translate-x-1/3 -translate-y-1/4 w-[600px] h-[600px] bg-blue-100/30 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 -z-10 -translate-x-1/4 translate-y-1/4 w-[500px] h-[500px] bg-indigo-50/40 rounded-full blur-3xl" />
        </section>
    );
};

export default AboutHero;
