"use client";

import React from 'react';
import { ShieldCheck, CircleDollarSign, CheckSquare } from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const Card = ({ icon: Icon, title, description, delay }: { icon: any, title: string, description: string, delay: string }) => {
    const reveal = useScrollReveal(0.15);
    return (
        <div
            ref={reveal.ref}
            className={`bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:shadow-blue-900/5 hover:-translate-y-2 transition-all duration-300 scroll-hidden ${reveal.isVisible ? 'scroll-visible' : ''}`}
            style={{ transitionDelay: delay }}
        >
            <div className="w-14 h-14 bg-blue-50 text-blue-900 flex items-center justify-center rounded-2xl mb-6">
                <Icon size={28} />
            </div>
            <h3 className="text-xl font-bold mb-3 text-gray-900">{title}</h3>
            <p className="text-gray-500 leading-relaxed">{description}</p>
        </div>
    );
};

const Features = () => {
    const headerReveal = useScrollReveal(0.2);

    return (
        <section className="py-24 bg-gray-50/50">
            <div className="max-w-7xl mx-auto px-6">
                {/* Section Header */}
                <div
                    ref={headerReveal.ref}
                    className={`text-center mb-20 space-y-4 scroll-hidden ${headerReveal.isVisible ? 'scroll-visible' : ''}`}
                >
                    <h2 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight">
                        Why Trust Us
                    </h2>
                    <p className="text-xl text-gray-500 max-w-2xl mx-auto font-medium">
                        The pillars of our architectural standard.
                    </p>
                </div>

                {/* Grid Layout */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <Card
                        icon={ShieldCheck}
                        title="Vetted Professionals"
                        description="Every service provider undergoes a rigorous background check and skills assessment by our core team."
                        delay="0s"
                    />
                    <Card
                        icon={CircleDollarSign}
                        title="Transparent Pricing"
                        description="No hidden fees. We provide detailed upfront quotes, ensuring your project stays within budget."
                        delay="0.15s"
                    />
                    <Card
                        icon={CheckSquare}
                        title="Quality Guarantee"
                        description="We stand by our work. All services are backed by a comprehensive satisfaction guarantee and post-service support."
                        delay="0.3s"
                    />
                </div>
            </div>
        </section>
    );
};

export default Features;
