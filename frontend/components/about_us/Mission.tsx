"use client";

import React from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const Mission = () => {
    const reveal = useScrollReveal(0.2);

    return (
        <section className="py-24 bg-white">
            <div
                ref={reveal.ref}
                className={`max-w-4xl mx-auto px-6 text-center space-y-10 scroll-hidden ${reveal.isVisible ? 'scroll-visible' : ''}`}
            >
                {/* Heading */}
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
                    Simplifying life through trusted services.
                </h2>

                {/* Description */}
                <p className="text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto">
                    Our mission is to empower homeowners by providing access to a vetted network
                    of professionals who prioritize quality, transparency, and integrity.
                    Your comfort is our blueprint.
                </p>

                {/* Thin Divider */}
                <div className="w-24 h-1 bg-blue-900/10 mx-auto rounded-full mt-16" />
            </div>
        </section>
    );
};

export default Mission;
