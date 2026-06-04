"use client";

import React from 'react';
import Image from 'next/image';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const AboutSection = () => {
    const textReveal = useScrollReveal(0.2);
    const imagesReveal = useScrollReveal(0.2);

    return (
        <section className="py-24 bg-gray-100/60 overflow-hidden">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    {/* Left Column: Text Content */}
                    <div
                        ref={textReveal.ref}
                        className={`space-y-8 scroll-hidden ${textReveal.isVisible ? 'scroll-visible' : ''}`}
                    >
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
                            Who We Are
                        </h2>
                        <div className="space-y-6 text-base text-gray-600 leading-relaxed">
                            <p>
                                Architectural Service was founded by a collective of
                                designers and operations experts who realized that finding
                                reliable home maintenance shouldn&apos;t feel like a chore.
                            </p>
                            <p>
                                We approach home care with the same rigor an architect
                                approaches a blueprint. Every professional in our network
                                is more than a contractor; they are a vetted partner in
                                maintaining your sanctuary&apos;s integrity.
                            </p>
                        </div>
                    </div>

                    {/* Right Column: Side-by-side Images */}
                    <div
                        ref={imagesReveal.ref}
                        className={`flex items-start gap-6 scroll-hidden ${imagesReveal.isVisible ? 'scroll-visible' : ''}`}
                        style={{ transitionDelay: '0.2s' }}
                    >
                        <div className="w-1/2 mt-8 rounded-2xl overflow-hidden shadow-lg transition-transform duration-500 hover:scale-105">
                            <Image
                                src="/images/about/writing.jpg"
                                alt="Architectural planning and design"
                                width={400}
                                height={300}
                                className="object-cover w-full h-[260px]"
                            />
                        </div>
                        <div className="w-1/2 mt-16 rounded-2xl overflow-hidden shadow-lg transition-transform duration-500 hover:scale-105">
                            <Image
                                src="/images/about/tech.jpg"
                                alt="Professional service provider"
                                width={400}
                                height={350}
                                className="object-cover w-full h-[300px]"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AboutSection;
